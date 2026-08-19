"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useAuthStore } from "@/state/authStore";
import { toast } from "@/state/uiStore";
import { messageErreurAuth } from "@/lib/auth/messages";
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
    isConfigured, isLoading, signInWithEmail, signUpWithEmail, confirmSignupCode,
    requestPasswordReset,
  } = useAuthStore();

  const [etape, setEtape] = useState<Etape>("connexion");
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

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
      const google = await compteVientDeGoogle(email.trim());
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
              Un code à 6 chiffres vient d&apos;être envoyé à {email}. Saisissez-le
              ici pour rester sur cette page — votre CV en cours n&apos;est pas perdu.
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
