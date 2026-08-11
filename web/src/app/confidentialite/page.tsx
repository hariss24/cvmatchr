import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité — CVMatchr",
};

export default function ConfidentialitePage() {
  return (
    <div className="wrap help-page">
      <header className="topbar topbar--secondary">
        <Link href="/" className="btn-nav">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Retour
        </Link>
        <div className="logo-badge">
          <div className="logo-icon"><div className="logo-icon-inner">T</div></div>
          <div className="logo-text">
            <span className="logo-title">CVMatchr</span>
          </div>
        </div>
        <div style={{ width: 100 }} className="mobile-hidden"></div>
      </header>

      <main className="help-container">
        <section className="help-section help-section--hero">
          <h1 className="help-title">Politique de confidentialité</h1>
          <p className="help-desc">
            Dernière mise à jour : 11 août 2026. CVMatchr est édité à titre individuel par
            Hariss Hafeji, contact : <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>.
          </p>
        </section>

        <section className="help-section">
          <h2>Deux façons d&apos;utiliser CVMatchr</h2>
          <p>
            <strong>Sans compte (mode invité)</strong> : tes CV, lettres, candidatures et offres
            restent stockés uniquement dans le navigateur (IndexedDB), sur ton appareil. Rien n&apos;est
            envoyé sur nos serveurs pour être conservé. Les seules données qui quittent ton navigateur
            sont celles que tu soumets explicitement à une fonctionnalité IA (voir « Intelligence
            artificielle » ci-dessous), traitées à la volée sans être stockées côté serveur.
          </p>
          <p>
            <strong>Avec un compte (connexion Google, optionnelle)</strong> : tes documents sont en
            plus répliqués sur nos serveurs pour être accessibles depuis plusieurs appareils. Le détail
            de ce qui est alors collecté est ci-dessous.
          </p>
        </section>

        <section className="help-section">
          <h2>Données collectées si tu crées un compte</h2>
          <ul className="help-list">
            <li><strong>Identité</strong> : adresse email, nom et photo de profil transmis par Google lors de la connexion.</li>
            <li><strong>Contenu</strong> : le texte de tes CV, lettres de motivation, candidatures suivies et offres sauvegardées.</li>
            <li><strong>Usage</strong> : un compteur du nombre de requêtes IA effectuées dans le mois, pour appliquer le quota gratuit.</li>
          </ul>
          <p>
            Ces données sont hébergées chez <strong>Supabase</strong> (base de données PostgreSQL, région
            Union Européenne — Stockholm), protégées par des règles d&apos;accès (Row Level Security) qui
            garantissent que seul ton compte peut lire ou modifier tes propres données — y compris nous,
            techniquement, sans passer par ces règles.
          </p>
        </section>

        <section className="help-section">
          <h2>Intelligence artificielle</h2>
          <p>
            Quand tu utilises une fonctionnalité IA (adaptation de CV, génération de lettre, score ATS…),
            le contenu concerné (CV, offre d&apos;emploi collée) est envoyé au fournisseur IA configuré pour
            être traité, puis la réponse t&apos;est retournée. Par défaut ce fournisseur est <strong>Google
            (modèles Gemini)</strong>. Si tu renseignes ta propre clé API dans les paramètres, le contenu est
            envoyé au fournisseur correspondant à cette clé (Google, Anthropic ou DeepSeek) à la place.
            Ce contenu n&apos;est pas conservé par CVMatchr au-delà du traitement de la requête ; il peut
            l&apos;être par le fournisseur IA selon sa propre politique.
          </p>
        </section>

        <section className="help-section">
          <h2>Autres services utilisés</h2>
          <ul className="help-list">
            <li><strong>Vercel</strong> : hébergement de l&apos;application, et mesure d&apos;audience anonymisée (sans cookies) via Vercel Analytics.</li>
            <li><strong>France Travail, Adzuna, JSearch</strong> : recherche d&apos;offres d&apos;emploi publiques. Aucune donnée personnelle ne leur est transmise, hormis les critères de recherche que tu saisis (métier, ville).</li>
            <li><strong>Google Maps</strong> : calcul de temps de trajet entre une ville que tu indiques et une offre, à la demande.</li>
            <li><strong>Brandfetch</strong> : récupération du logo d&apos;une entreprise à partir de son nom, pour l&apos;affichage des offres.</li>
          </ul>
        </section>

        <section className="help-section">
          <h2>Cookies</h2>
          <p>
            En mode invité, CVMatchr ne pose aucun cookie de suivi. Si tu te connectes, un cookie de
            session strictement nécessaire (géré par Supabase Auth) est utilisé pour te garder connecté
            entre deux visites. Aucun cookie publicitaire ou de traçage tiers n&apos;est utilisé.
          </p>
        </section>

        <section className="help-section">
          <h2>Tes droits</h2>
          <p>
            Conformément au RGPD, tu peux demander l&apos;accès, la rectification, l&apos;export ou la
            suppression de tes données à tout moment en écrivant à{" "}
            <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>. La suppression d&apos;un
            compte entraîne la suppression en cascade de l&apos;ensemble des données associées (profil,
            CV, lettres, candidatures, offres sauvegardées).
          </p>
        </section>

        <section className="help-section">
          <h2>Mineurs</h2>
          <p>CVMatchr ne s&apos;adresse pas aux personnes de moins de 15 ans.</p>
        </section>

        <section className="help-section">
          <h2>Modifications</h2>
          <p>
            Cette politique peut évoluer avec les fonctionnalités de CVMatchr. La date de dernière mise
            à jour en haut de cette page reflète la version en vigueur.
          </p>
        </section>
      </main>
    </div>
  );
}
