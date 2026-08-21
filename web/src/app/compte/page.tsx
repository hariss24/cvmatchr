"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/state/authStore";
import { toast, uiConfirm, uiPrompt } from "@/state/uiStore";
import { messageErreurAuth } from "@/lib/auth/messages";
import { validerEmail, validerMotDePasse } from "@/lib/auth/validation";

/**
 * Tout ce qu'une personne peut faire de son compte.
 *
 * Jusqu'au 20/08/2026 il n'existait rien : ni voir son adresse, ni changer son
 * mot de passe, ni supprimer son compte — alors que la politique de
 * confidentialité promettait cette suppression « en cascade ».
 */
export default function PageCompte() {
  const router = useRouter();
  const {
    user, isLoading, changePassword, changeEmail, signOutOthers, deleteAccount,
  } = useAuthStore();

  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // État propre au changement d'adresse : mêler les deux formulaires ferait
  // qu'une erreur de mot de passe s'afficherait sous le mauvais.
  const [nouvelleAdresse, setNouvelleAdresse] = useState("");
  const [mdpAdresse, setMdpAdresse] = useState("");
  const [erreurAdresse, setErreurAdresse] = useState<string | null>(null);
  const [enCoursAdresse, setEnCoursAdresse] = useState(false);
  const [supprime, setSupprime] = useState(false);

  // Cette page n'a aucun sens sans compte. `isLoading` est attendu : la session
  // revient d'elle-même au chargement, rediriger avant reviendrait à éjecter
  // quelqu'un de parfaitement connecté.
  // ⚠️ `supprime` court-circuite la garde. Sans lui, la suppression déclenche
  // deux redirections concurrentes — celle qu'on demande vers l'accueil et
  // celle-ci, que la disparition de `user` réveille — et la destination
  // dépendait de laquelle arrivait la première.
  useEffect(() => {
    if (supprime) return;
    if (!isLoading && !user) router.replace("/connexion");
  }, [user, isLoading, router, supprime]);

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

  async function changerAdresse(e: React.FormEvent) {
    e.preventDefault();
    setErreurAdresse(null);
    const faute = validerEmail(nouvelleAdresse);
    if (faute) return setErreurAdresse(faute);

    setEnCoursAdresse(true);
    try {
      await changeEmail(mdpAdresse, nouvelleAdresse.trim());
      toast("Vérifiez vos deux boîtes : le changement attend vos confirmations.", "success");
      setNouvelleAdresse("");
      setMdpAdresse("");
    } catch (err) {
      setErreurAdresse(messageErreurAuth((err as Error).message ?? ""));
    } finally {
      setEnCoursAdresse(false);
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

    setSupprime(true);
    try {
      await deleteAccount();
      toast("Votre compte a été supprimé.", "success");
      router.replace("/");
    } catch (err) {
      setSupprime(false);
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

        {!viaGoogle && (
          <section className="compte__bloc">
            <h2 className="compte__titre">Changer d&apos;adresse email</h2>
            <p className="compte__aide">
              Deux messages de confirmation seront envoyés : un à votre adresse actuelle, un à
              la nouvelle. Le changement ne prend effet qu&apos;une fois les deux liens ouverts —
              c&apos;est ce qui empêche qu&apos;on détourne votre compte à votre insu.
            </p>
            <form onSubmit={changerAdresse} className="connexion__form" noValidate>
              <label className="connexion__champ">
                Nouvelle adresse email
                <input
                  type="email"
                  autoComplete="email"
                  value={nouvelleAdresse}
                  onChange={(e) => setNouvelleAdresse(e.target.value)}
                />
              </label>
              <label className="connexion__champ">
                Mot de passe, pour confirmer
                <input
                  type="password"
                  autoComplete="current-password"
                  value={mdpAdresse}
                  onChange={(e) => setMdpAdresse(e.target.value)}
                />
              </label>
              {erreurAdresse && <p className="connexion__erreur" role="alert">{erreurAdresse}</p>}
              <button type="submit" className="connexion__valider" disabled={enCoursAdresse}>
                Envoyer les confirmations
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
