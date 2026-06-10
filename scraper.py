import urllib.request
from urllib.parse import urlparse, urlunparse
import ipaddress
import socket
import threading
import re as _re
import logging as _logging

# ---------------------------------------------------------------------------
# Extracteur d'offre d'emploi (scraping URL)
# ---------------------------------------------------------------------------

_logger = _logging.getLogger(__name__)

_EXTRACT_MAX_CHARS = 15_000
_EXTRACT_TIMEOUT_MS = 20_000
_SCRAPE_SEMAPHORE = threading.Semaphore(2)

# Toutes les plages IP à bloquer (SSRF) — RFC 1918, 6598, 3927, 5737, etc.
_BLOCKED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    ipaddress.ip_network("0.0.0.0/8"),       # "This" network
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),   # RFC 6598 CGN
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),    # IETF protocol
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),   # benchmarking RFC 2544
    ipaddress.ip_network("224.0.0.0/4"),     # multicast
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::ffff:0:0/96"),   # IPv4-mapped IPv6
]


def _is_blocked_ip(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    # Normalise les adresses IPv4-mapped (::ffff:127.0.0.1 → 127.0.0.1)
    # pour que le test d'appartenance aux réseaux IPv4 fonctionne correctement.
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        addr = addr.ipv4_mapped
    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast or addr.is_unspecified:
        return True
    return any(addr in net for net in _BLOCKED_NETWORKS if addr.version == net.version)


def _validate_url(url: str) -> tuple[str, str | None]:
    """Valide l'URL et retourne (url_nettoyée, erreur_ou_None).

    Supprime les credentials embarqués, vérifie le schéma et toutes les adresses
    résolues (IPv4 + IPv6) contre la liste de plages bloquées.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url, "URL invalide : seuls http et https sont autorisés."
    hostname = parsed.hostname
    if not hostname:
        return url, "URL invalide : hôte manquant."

    # Supprime les credentials (user:pass@host → host) avant de passer à Playwright
    clean_netloc = hostname + (f":{parsed.port}" if parsed.port else "")
    clean_url = urlunparse((parsed.scheme, clean_netloc, parsed.path, parsed.params, parsed.query, ""))

    try:
        # getaddrinfo couvre IPv4 et IPv6, contrairement à gethostbyname
        results = socket.getaddrinfo(hostname, None)
        for result in results:
            addr = ipaddress.ip_address(result[4][0])
            if _is_blocked_ip(addr):
                return clean_url, "URL non autorisée."
    except OSError:
        return clean_url, "Impossible de résoudre l'hôte."

    return clean_url, None


def _make_route_guard():
    """Retourne un handler Playwright qui re-valide l'IP au moment de chaque requête.

    Défense en profondeur contre le DNS rebinding : la validation initiale peut
    être contournée si le TTL DNS expire entre la vérification et la connexion.
    """
    def _guard(route, _request):
        try:
            req_host = urlparse(_request.url).hostname or ""
            if req_host:
                for result in socket.getaddrinfo(req_host, None):
                    if _is_blocked_ip(ipaddress.ip_address(result[4][0])):
                        route.abort("blockedbyclient")
                        return
        except Exception:
            pass
        route.continue_()
    return _guard


def _scrape_job_text(url: str) -> tuple[str, str]:
    """Scrape une page d'offre d'emploi via Playwright. Retourne (texte, titre)."""
    from playwright.sync_api import sync_playwright

    if not _SCRAPE_SEMAPHORE.acquire(timeout=5):
        raise RuntimeError("Trop de requêtes simultanées. Réessayez dans quelques secondes.")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(
                    user_agent="Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36"
                )
                page.route("**/*", _make_route_guard())
                page.goto(url, wait_until="domcontentloaded", timeout=_EXTRACT_TIMEOUT_MS)
                page.wait_for_timeout(1500)
                title = page.title() or ""

                page.evaluate("""() => {
                    const noise = ['nav','header','footer','aside','script','style',
                        '[class*="cookie"]','[class*="Cookie"]','[id*="cookie"]',
                        '[class*="banner"]','[class*="modal"]','[class*="popup"]',
                        '[class*="sidebar"]','[class*="Sidebar"]',
                        '[role="navigation"]','[role="banner"]','[role="complementary"]'];
                    noise.forEach(s => {
                        try { document.querySelectorAll(s).forEach(el => el.remove()); } catch(_) {}
                    });
                }""")

                text = page.evaluate("""() => {
                    const candidates = [
                        document.querySelector('[class*="job-description"]'),
                        document.querySelector('[class*="offer-description"]'),
                        document.querySelector('[class*="jobDescription"]'),
                        document.querySelector('[class*="posting-description"]'),
                        document.querySelector('[data-qa="job-description"]'),
                        document.querySelector('article'),
                        document.querySelector('main'),
                        document.body,
                    ];
                    for (const el of candidates) {
                        const t = el && el.innerText && el.innerText.trim();
                        if (t && t.length > 100) return t;
                    }
                    return '';
                }""")

                text = _re.sub(r"\n{3,}", "\n\n", text or "").strip()
                
                is_blocked = (
                    len(text) < 200 or 
                    "Sign Up" in title or 
                    "Connexion" in title or 
                    "S'inscrire" in title or
                    "Security" in title or 
                    "Cloudflare" in title
                )

                if is_blocked:
                    try:
                        req = urllib.request.Request(
                            f"https://r.jina.ai/{url}",
                            headers={"User-Agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36"}
                        )
                        jina_resp = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
                        if len(jina_resp) > 500 and "Sign Up | LinkedIn" not in jina_resp and "Connexion | LinkedIn" not in jina_resp and "S'inscrire" not in jina_resp and "Requête bloquée" not in jina_resp and "Vous avez été bloqué" not in jina_resp:
                            # Nettoyage du Markdown pour réduire le bruit (menus, images, listes d'autres offres)
                            jina_resp = _re.sub(r'!\[[^\]]*\]\([^)]+\)', '', jina_resp) # Supprime les images
                            jina_resp = _re.sub(r'\[([^\]]*)\]\([^)]+\)', r'\1', jina_resp) # Garde le texte des liens (même vides)
                            
                            footer_markers = [
                                "annonces similaires", "offres similaires", "ces offres peuvent",
                                "plan du site", "gestion des cookies", "mentions légales",
                                "inscription à la newsletter", "politique de confidentialité"
                            ]
                            nav_noise = [
                                "espace candidat", "espace entreprise", "déposer son cv", "nouvelle recherche",
                                "qui sommes-nous", "répondre en ligne", "connexion inscription", "mot de passe oublié",
                                "entreprises qui recrutent", "faq des", "enregistrer vos annonces", "nos tarifs",
                                "inscriptionconnexion", "taille du texte"
                            ]
                            exact_noise = {
                                "×", "menu", "offres d'emploi", "statistiques", "contact", 
                                "news les dernières news", "aa+aa-", "imprimer", "site internet",
                                "actualité", "vidéos", "défilés", "galeries", "podcasts", "agenda", "partenaires"
                            }
                            
                            lines = []
                            for line in jina_resp.split('\n'):
                                line_clean = line.strip()
                                content = line_clean.lstrip('*>- ').strip()
                                line_lower = content.lower()
                                
                                # Coupe la fin du document dès qu'on tombe sur le footer ou les suggestions
                                if any(marker in line_lower for marker in footer_markers) and len(lines) > 10:
                                    break
                                    
                                # Ignore les puces très courtes typiques de menus ou annonces annexes
                                if line_clean.startswith('*'):
                                    words = content.split()
                                    if len(words) < 5: # Puce très courte (Menu)
                                        continue
                                    if 'il y a' in line_lower or 'news' in line_lower or 'offre' in line_lower or 'dans quelques' in line_lower:
                                        continue
                                
                                # Ignore les lignes de navigation pures
                                if len(content) < 40 and any(nav in line_lower for nav in nav_noise):
                                    continue
                                    
                                # Retire les lignes inutiles isolées
                                if line_lower in exact_noise:
                                    continue
                                    
                                # Ignorer les lignes de fil d'Ariane
                                if '›' in line_clean and 'accueil' in line_lower:
                                    continue
                                    
                                lines.append(line_clean)
                                
                            text = '\n'.join(lines)
                            text = _re.sub(r'\n{3,}', '\n\n', text).strip()
                            for line in text.split('\n')[:10]:
                                if line.startswith("Title: "):
                                    title = line[7:].strip()
                                    break
                    except Exception as e:
                        _logger.warning("Jina Reader fallback failed: %s", str(e))
                
                # Ultime vérification : si le texte final est un message de blocage Cloudflare/Datadome
                if "Requête bloquée" in text or "Vous avez été bloqué" in text or "Just a moment" in text or "Cloudflare" in text:
                    raise ValueError("BLOCKED")

                return text[:_EXTRACT_MAX_CHARS], title
            finally:
                browser.close()
    finally:
        _SCRAPE_SEMAPHORE.release()

