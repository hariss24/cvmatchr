"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useAuthStore } from "@/state/authStore";
import { toast } from "@/state/uiStore";
import { messageErreurAuth, erreurPeutVenirDeGoogle } from "@/lib/auth/messages";
import { validerEmail, validerMotDePasse } from "@/lib/auth/validation";

type Etape = "connexion" | "inscription" | "code" | "oubli";

/**
 * Les quatre états de la page /connexion.
 *
 * Google et le formulaire sont deux chemins EXCLUSIFS : un clic sur Google
 * inscrit et connecte d'un coup, sans mot de passe ni code. L'état `code` ne
 * concerne donc jamais quelqu'un venu par Google.
 */
export default function FormulaireConnexion() {
  const router = useRouter();
  const {
    user, isConfigured, isLoading, signInWithEmail, signUpWithEmail,
    confirmSignupCode, requestPasswordReset,
  } = useAuthStore();

  // Quelqu'un de déjà connecté n'a rien à faire ici : la session revenant
  // d'elle-même au chargement, il verrait sinon un formulaire de connexion
  // alors qu'il l'est déjà. `replace` et non `push` : la page ne doit pas
  // rester dans l'historique, sans quoi le bouton Retour y ramène en boucle.
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  const [etape, setEtape] = useState<Etape>("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Retour de /auth/callback quand la session n'a pas pu s'ouvrir ici. On lit
  // `window.location` et non `useSearchParams` : ce dernier impose une
  // frontière Suspense au rendu statique, pour une valeur dont on n'a besoin
  // qu'une fois, côté navigateur.
  //
  // `setErreur` dans un effet est signalé par ESLint, à raison en général. Ici
  // c'est le seul endroit sûr : initialiser l'état avec la valeur de l'URL la
  // rendrait absente du rendu serveur et présente au client, soit exactement la
  // divergence d'hydratation que React refuse.
  useEffect(() => {
    const motifs: Record<string, string> = {
      session_impossible:
        "La session n'a pas pu s'ouvrir sur cet appareil. Si vous venez de confirmer votre adresse, connectez-vous ci-dessous.",
      lien_expire:
        "Ce lien n'est plus valable : il expire au bout d'une heure et ne sert qu'une fois. Demandez-en un nouveau ci-dessous.",
    };
    const motif = motifs[new URLSearchParams(window.location.search).get("erreur") ?? ""];
    if (motif) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErreur(motif);
    }
  }, []);

  // Déblocage automatique de cet onglet. Le lien du courriel ne peut ouvrir une
  // session QUE dans le navigateur où l'inscription a eu lieu : la clé de
  // vérification qu'il faut lui associer n'existe nulle part ailleurs. Quelqu'un
  // qui clique depuis son téléphone confirme donc bien son adresse, mais cette
  // page-ci ne reçoit rien et resterait figée sur la saisie du code.
  //
  // On retente donc la connexion en arrière-plan avec les identifiants que la
  // personne vient de saisir : Supabase la refuse tant que l'adresse n'est pas
  // confirmée, et l'accepte à la seconde où elle l'est. L'effet sur `user`
  // ci-dessus se charge alors de la redirection.
  //
  // 15 s et non 5 : Supabase plafonne les tentatives à 30 par tranche de cinq
  // minutes ET PAR ADRESSE IP. Plus vif, on épuiserait le quota de toutes les
  // personnes derrière la même box — y compris celles qui essaient juste de se
  // connecter.
  useEffect(() => {
    if (etape !== "code" || !motDePasse) return;
    const fin = Date.now() + 5 * 60_000;
    const minuteur = setInterval(() => {
      if (Date.now() >= fin) return clearInterval(minuteur);
      // L'échec est le cas NORMAL ici (« Email not confirmed ») : on l'ignore
      // en silence, sinon une erreur surgirait à l'écran toutes les 15 s.
      signInWithEmail(email.trim(), motDePasse).catch(() => {});
    }, 15_000);
    return () => clearInterval(minuteur);
  }, [etape, email, motDePasse, signInWithEmail]);

  /**
   * Appelée UNIQUEMENT après un échec de mot de passe (cf. la route
   * /api/auth/methode). Un échec réseau vaut « je ne sais pas » : on retombe
   * alors sur le message générique.
   */
  async function compteVientDeGoogle(adresse: string): Promise<boolean> {
    try {
      const reponse = await fetch("/api/auth/methode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adresse }),
      });
      if (!reponse.ok) return false;
      const donnees = await reponse.json();
      return donnees.google === true;
    } catch {
      return false;
    }
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    if (etape === "code") {
      setEnCours(true);
      try {
        // `email.trim()` et non `email` : l'inscription a été faite sur
        // l'adresse nettoyée. Confirmer avec la version brute ferait échouer la
        // vérification pour quiconque a laissé une espace en collant son adresse.
        await confirmSignupCode(email.trim(), code.trim());
        toast("Votre adresse est confirmée.", "success");
        router.push("/");
      } catch (err) {
        setErreur(messageErreurAuth((err as Error).message ?? ""));
      } finally {
        setEnCours(false);
      }
      return;
    }

    const fauteEmail = validerEmail(email);
    if (fauteEmail) return setErreur(fauteEmail);

    if (etape === "oubli") {
      setEnCours(true);
      try {
        await requestPasswordReset(email.trim());
        // Formulé pour ne pas révéler si l'adresse est inscrite.
        toast("Si un compte existe pour cette adresse, un lien vient d'être envoyé.", "success");
        setEtape("connexion");
      } catch (err) {
        setErreur(messageErreurAuth((err as Error).message ?? ""));
      } finally {
        setEnCours(false);
      }
      return;
    }

    const fauteMotDePasse = validerMotDePasse(motDePasse);
    if (fauteMotDePasse) return setErreur(fauteMotDePasse);

    setEnCours(true);
    try {
      if (etape === "inscription") {
        await signUpWithEmail(email.trim(), motDePasse);
        setEtape("code");
      } else {
        await signInWithEmail(email.trim(), motDePasse);
        router.push("/");
      }
    } catch (err) {
      // Les deux échecs méritent la question : « mot de passe refusé » et
      // « adresse déjà prise » ont la même cause quand le compte vient de
      // Google, et la même réponse utile.
      const brut = (err as Error).message ?? "";
      // On ne pose la question que si la réponse peut servir : une coupure
      // réseau ne dit rien de la méthode d'inscription, et l'appel
      // consommerait le compteur de débit pour rien.
      const google = erreurPeutVenirDeGoogle(brut)
        ? await compteVientDeGoogle(email.trim())
        : false;
      setErreur(messageErreurAuth(brut, google));
    } finally {
      setEnCours(false);
    }
  }

  // `isLoading` est vrai tant que `initAuth()` n'a pas répondu, et `isConfigured`
  // vaut alors encore `false` : sans cette condition, le HTML servi pour
  // /connexion ne contient QUE « connexion indisponible » — le premier écran
  // d'un visiteur venu créer un compte lui annonce que c'est impossible, avant
  // de se corriger une fois le JavaScript exécuté. Vérifié le 19/08 sur le HTML
  // rendu, pas déduit.
  if (!isConfigured && !isLoading) {
    return <p className="connexion__indispo">La connexion est indisponible sur cette installation.</p>;
  }

  const titres: Record<Etape, string> = {
    connexion: "Se connecter",
    inscription: "Créer un compte",
    code: "Confirmer votre adresse",
    oubli: "Mot de passe oublié",
  };

  return (
    <div className="connexion">
      <h1 className="connexion__titre">{titres[etape]}</h1>

      {etape !== "code" && etape !== "oubli" && (
        <>
          <div className="connexion__google">
            <GoogleSignInButton />
          </div>
          <p className="connexion__ou">ou</p>
        </>
      )}

      <form onSubmit={soumettre} className="connexion__form" noValidate>
        {etape === "code" ? (
          <>
            <p className="connexion__aide">
              Un email vient d&apos;être envoyé à {email}. Cliquez sur le lien
              qu&apos;il contient, ou saisissez le code ci-dessous. Cette page se
              débloque d&apos;elle-même dès que votre adresse est confirmée, même
              depuis un autre appareil.
            </p>
            <label className="connexion__champ">
              Code reçu par email
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            <label className="connexion__champ">
              Adresse email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            {etape !== "oubli" && (
              <label className="connexion__champ">
                Mot de passe
                <input
                  type="password"
                  autoComplete={etape === "inscription" ? "new-password" : "current-password"}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                />
              </label>
            )}
          </>
        )}

        {erreur && <p className="connexion__erreur" role="alert">{erreur}</p>}

        <button type="submit" className="connexion__valider" disabled={enCours}>
          {etape === "connexion" && "Se connecter"}
          {etape === "inscription" && "Créer mon compte"}
          {etape === "code" && "Confirmer"}
          {etape === "oubli" && "Envoyer le lien"}
        </button>
      </form>

      {/* Uniquement à l'inscription : c'est le seul moment où quelque chose est
          accepté. L'afficher à la connexion laisserait croire qu'on redemande
          un consentement à chaque visite. */}
      {etape === "inscription" && (
        <p className="connexion__mentions">
          En créant un compte, vous acceptez les{" "}
          <Link href="/conditions-utilisation">conditions d&apos;utilisation</Link> et la{" "}
          <Link href="/confidentialite">politique de confidentialité</Link>.
        </p>
      )}

      <div className="connexion__liens">
        {etape === "connexion" && (
          <>
            <button type="button" onClick={() => { setErreur(null); setEtape("inscription"); }}>
              Créer un compte
            </button>
            <button type="button" onClick={() => { setErreur(null); setEtape("oubli"); }}>
              Mot de passe oublié
            </button>
          </>
        )}
        {etape !== "connexion" && (
          <button type="button" onClick={() => { setErreur(null); setEtape("connexion"); }}>
            Retour à la connexion
          </button>
        )}
      </div>
    </div>
  );
}
