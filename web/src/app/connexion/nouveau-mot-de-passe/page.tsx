"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/state/authStore";
import { toast } from "@/state/uiStore";
import { messageErreurAuth } from "@/lib/auth/messages";
import { validerMotDePasse } from "@/lib/auth/validation";

/**
 * Fin du parcours « mot de passe oublié ». On arrive ici depuis le lien du
 * courriel, après que /auth/callback a échangé le code contre une session de
 * récupération. Sans cette session, `updateUser` échoue — le message renvoyé
 * l'explique, plutôt que de laisser un écran muet.
 */
export default function PageNouveauMotDePasse() {
  const router = useRouter();
  const { updatePassword } = useAuthStore();
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);

    const faute = validerMotDePasse(motDePasse);
    if (faute) return setErreur(faute);

    setEnCours(true);
    try {
      await updatePassword(motDePasse);
      toast("Votre mot de passe est enregistré.", "success");
      router.push("/");
    } catch (err) {
      setErreur(messageErreurAuth((err as Error).message ?? ""));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="connexion-page">
      <div className="connexion">
        <h1 className="connexion__titre">Nouveau mot de passe</h1>
        <form onSubmit={soumettre} className="connexion__form" noValidate>
          <label className="connexion__champ">
            Nouveau mot de passe
            <input
              type="password"
              autoComplete="new-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </label>

          {erreur && <p className="connexion__erreur" role="alert">{erreur}</p>}

          <button type="submit" className="connexion__valider" disabled={enCours}>
            Enregistrer
          </button>
        </form>
      </div>
    </main>
  );
}
