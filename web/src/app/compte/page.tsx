"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/state/authStore";
import { toast, uiConfirm, uiPrompt } from "@/state/uiStore";
import { messageErreurAuth } from "@/lib/auth/messages";
import { validerMotDePasse } from "@/lib/auth/validation";

/**
 * Tout ce qu'une personne peut faire de son compte.
 *
 * Jusqu'au 20/08/2026 il n'existait rien : ni voir son adresse, ni changer son
 * mot de passe, ni supprimer son compte — alors que la politique de
 * confidentialité promettait cette suppression « en cascade ».
 */
export default function PageCompte() {
  const router = useRouter();
  const { user, isLoading, changePassword, signOutOthers, deleteAccount } = useAuthStore();

  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Cette page n'a aucun sens sans compte. `isLoading` est attendu : la session
  // revient d'elle-même au chargement, rediriger avant reviendrait à éjecter
  // quelqu'un de parfaitement connecté.
  useEffect(() => {
    if (!isLoading && !user) router.replace("/connexion");
  }, [user, isLoading, router]);

  if (!user) return null;

  /**
   * Un compte Google n'a jamais eu de mot de passe : lui en proposer un
   * changement afficherait un formulaire qu'aucune saisie ne peut satisfaire.
   */
  const viaGoogle = user.app_metadata?.provider === "google";

  async function changer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const faute = validerMotDePasse(nouveau);
    if (faute) return setErreur(faute);
    if (ancien === nouveau) return setErreur("Le nouveau mot de passe est identique à l'ancien.");

    setEnCours(true);
    try {
      await changePassword(ancien, nouveau);
      toast("Votre mot de passe est changé.", "success");
      setAncien("");
      setNouveau("");
    } catch (err) {
      setErreur(messageErreurAuth((err as Error).message ?? ""));
    } finally {
      setEnCours(false);
    }
  }

  async function fermerLesAutres() {
    try {
      await signOutOthers();
      toast("Les autres appareils sont déconnectés.", "success");
    } catch {
      toast("Impossible de fermer les autres sessions.", "error");
    }
  }

  async function supprimer() {
    const prevenu = await uiConfirm(
      "Votre compte et TOUTES vos données seront effacés définitivement : CV, lettres, "
      + "candidatures, offres sauvegardées et profil. Cette action est irréversible.",
      "Supprimer le compte",
    );
    if (!prevenu) return;

    // Une seconde confirmation, tapée à la main : un bouton rouge se clique par
    // réflexe, un mot se tape en connaissance de cause.
    const saisie = await uiPrompt(
      "Pour confirmer, tapez SUPPRIMER en majuscules.",
      "",
      "Confirmation définitive",
    );
    if (saisie?.trim() !== "SUPPRIMER") return;

    try {
      await deleteAccount();
      toast("Votre compte a été supprimé.", "success");
      router.push("/");
    } catch (err) {
      toast((err as Error).message ?? "Suppression impossible.", "error");
    }
  }

  return (
    <main className="connexion-page">
      <div className="connexion compte">
        <h1 className="connexion__titre">Mon compte</h1>

        <section className="compte__bloc">
          <h2 className="compte__titre">Identifiants</h2>
          <p className="compte__ligne">
            <span className="compte__etiquette">Adresse</span>
            <span>{user.email}</span>
          </p>
          <p className="compte__ligne">
            <span className="compte__etiquette">Connexion</span>
            <span>{viaGoogle ? "Compte Google" : "Email et mot de passe"}</span>
          </p>
        </section>

        {!viaGoogle && (
          <section className="compte__bloc">
            <h2 className="compte__titre">Changer de mot de passe</h2>
            <form onSubmit={changer} className="connexion__form" noValidate>
              <label className="connexion__champ">
                Mot de passe actuel
                <input
                  type="password"
                  autoComplete="current-password"
                  value={ancien}
                  onChange={(e) => setAncien(e.target.value)}
                />
              </label>
              <label className="connexion__champ">
                Nouveau mot de passe
                <input
                  type="password"
                  autoComplete="new-password"
                  value={nouveau}
                  onChange={(e) => setNouveau(e.target.value)}
                />
              </label>
              {erreur && <p className="connexion__erreur" role="alert">{erreur}</p>}
              <button type="submit" className="connexion__valider" disabled={enCours}>
                Enregistrer le nouveau mot de passe
              </button>
            </form>
          </section>
        )}

        <section className="compte__bloc">
          <h2 className="compte__titre">Sécurité</h2>
          <p className="compte__aide">
            Si vous vous êtes connecté sur un ordinateur qui n&apos;est pas le vôtre, fermez
            les sessions ouvertes ailleurs. Celle-ci reste active.
          </p>
          <button type="button" className="compte__bouton" onClick={fermerLesAutres}>
            Déconnecter les autres appareils
          </button>
        </section>

        <section className="compte__bloc compte__bloc--danger">
          <h2 className="compte__titre">Supprimer mon compte</h2>
          <p className="compte__aide">
            Efface définitivement votre compte et tout ce qu&apos;il contient : CV, lettres,
            candidatures, offres sauvegardées et profil. Rien n&apos;est récupérable ensuite.
            Pensez à exporter ce que vous voulez garder avant.
          </p>
          <button type="button" className="compte__bouton compte__bouton--danger" onClick={supprimer}>
            Supprimer mon compte
          </button>
        </section>

        <p className="connexion__mentions">
          <Link href="/confidentialite">Politique de confidentialité</Link>
        </p>
      </div>
    </main>
  );
}
