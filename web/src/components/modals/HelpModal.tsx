"use client";

import { promptApiKey } from "@/lib/settings";

/**
 * Fenêtre d'aide « Comment ça marche ? » — contenu statique expliquant l'usage de l'app.
 * Ouverte depuis la barre d'actions du bas (ActionsBar). Aucun appel réseau.
 */
export default function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="ui-overlay" role="presentation" onClick={onClose}>
      <div
        className="ui-dialog help-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Comment ça marche ?"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="ui-dialog__title">Comment ça marche ?</h2>

        <div className="help-body">
          <section className="help-section">
            <h3 className="help-section__title">Bienvenue</h3>
            <p>
              cv-tailor t&apos;aide à créer ton CV ou ta lettre, à les adapter à une offre grâce à
              l&apos;IA, puis à les exporter en PDF.
            </p>
          </section>

          <section className="help-section">
            <h3 className="help-section__title">Démarrer en 4 étapes</h3>
            <ol className="help-steps">
              <li>Importe ton CV (PDF ou texte) avec « Importer un PDF », ou pars du modèle par défaut.</li>
              <li>Complète les champs dans le formulaire.</li>
              <li>Clique « Adapter à une offre », colle l&apos;annonce : l&apos;IA adapte ton CV.</li>
              <li>Exporte en PDF (bouton en haut, ou Ctrl+Entrée).</li>
            </ol>
          </section>

          <section className="help-section">
            <h3 className="help-section__title">Le « CV Maître »</h3>
            <p>
              C&apos;est ton CV le plus complet (toute ton expérience). Quand tu adaptes à une offre,
              l&apos;IA y pioche et élague le superflu pour tenir sur une page. Tu l&apos;actives en
              cochant « Utiliser le CV Maître » dans la fenêtre d&apos;adaptation.
            </p>
          </section>

          <section className="help-section">
            <h3 className="help-section__title">Formulaire ou mode Expert</h3>
            <p>
              Le <strong>Formulaire</strong> (recommandé) te laisse remplir des champs simples. Le
              mode <strong>Expert</strong> montre le code : le <strong>JSON</strong> = tes données
              structurées, le <strong>HTML/CSS</strong> = la mise en page. Réservé aux usages avancés.
            </p>
          </section>

          <section className="help-section">
            <h3 className="help-section__title">Ta clé API (IA)</h3>
            <p>
              Par défaut, l&apos;app utilise une clé serveur partagée. Tu peux renseigner ta propre
              clé (Gemini ou Anthropic) pour ne pas dépendre du quota commun. Une clé Gemini gratuite
              s&apos;obtient sur Google AI Studio.
            </p>
            <button type="button" className="go" onClick={() => promptApiKey()}>
              Régler ma clé API
            </button>
          </section>

          <section className="help-section">
            <h3 className="help-section__title">Bon à savoir</h3>
            <ul className="help-list">
              <li><strong>Offres</strong> : cherche et note des offres d&apos;emploi, puis adapte ton CV en un clic.</li>
              <li><strong>Pack candidature</strong> : génère une lettre de motivation + un email d&apos;accompagnement.</li>
              <li><strong>ATS</strong> : mesure la compatibilité de ton CV avec l&apos;offre (mots-clés).</li>
              <li><strong>Snapshots &amp; Historique</strong> : sauvegardes de versions que tu peux restaurer.</li>
            </ul>
          </section>

          <section className="help-section">
            <h3 className="help-section__title">Raccourcis clavier</h3>
            <ul className="help-list">
              <li><strong>Ctrl+Entrée</strong> → exporter en PDF</li>
              <li><strong>Ctrl+Maj+S</strong> → ouvrir les Snapshots</li>
            </ul>
          </section>
        </div>

        <div className="ui-dialog__actions">
          <button type="button" className="form-btn-mini" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
