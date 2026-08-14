"use client";

import Link from "next/link";
import { promptApiKey } from "@/lib/settings";
import { useState } from "react";
import BrandBadge from "@/components/layout/BrandBadge";

function FaqAccordion({ question, children }: { question: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-accordion ${open ? "is-open" : ""}`}>
      <button type="button" className="faq-summary" onClick={() => setOpen(!open)} aria-expanded={open} style={{ width: "100%", background: "none", border: "none", textAlign: "left", font: "inherit" }}>
        <span className="faq-question">{question}</span>
        <svg className="faq-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div className={`form-collapse ${open ? "is-open" : ""}`} aria-hidden={!open}>
        <div className="form-collapse-inner">
          <div className="faq-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="wrap help-page">
      <header className="topbar topbar--secondary">
        <Link href="/" className="btn-nav">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
          Retour
        </Link>
        <BrandBadge />
        <div style={{ width: 100 }} className="mobile-hidden"></div>
      </header>

      <main className="help-container">
        <section className="help-section help-section--hero">
          <h1 className="help-title">Comment fonctionne CVMatchr ?</h1>
          <p className="help-desc">
            CVMatchr adapte votre CV et vos lettres de motivation à chaque offre d&apos;emploi,
            avec l&apos;aide de l&apos;intelligence artificielle. L&apos;objectif : passer les
            filtres automatiques de recrutement (ATS) sans y passer vos soirées.
          </p>
          <p className="help-desc">
            <strong>Vous pouvez l&apos;utiliser immédiatement, sans créer de compte.</strong> Dans ce
            cas, vos documents restent stockés uniquement dans votre navigateur. Créer un compte est
            optionnel, et sert à retrouver vos documents sur plusieurs appareils.
          </p>
        </section>

        <section className="help-section">
          <h2>Foire aux questions</h2>

          <FaqAccordion question="Comment démarrer en 4 étapes ?">
            <ol className="help-steps">
              <li>Importez votre CV (PDF ou texte) avec « Importer un PDF », ou partez du modèle par défaut.</li>
              <li>Complétez les champs dans le formulaire.</li>
              <li>Cliquez « Adapter à une offre » et collez l&apos;annonce : l&apos;IA adapte votre CV.</li>
              <li>Exportez en PDF (bouton en haut, ou Ctrl+Entrée).</li>
            </ol>
          </FaqAccordion>

          <FaqAccordion question="Ai-je besoin de créer un compte ?">
            <p>
              Non. L&apos;édition, l&apos;adaptation à une offre et l&apos;export PDF fonctionnent
              sans compte. Un compte apporte deux choses : la <strong>synchronisation</strong>{" "}de vos
              documents entre plusieurs appareils, et l&apos;accès au <strong>quota d&apos;IA
              offert</strong>{" "}sans avoir à fournir votre propre clé API.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Où sont stockées mes données ?">
            <p>
              <strong>Sans compte :</strong>{" "}tout reste dans le stockage local de votre navigateur
              (IndexedDB). Rien n&apos;est conservé sur nos serveurs.
            </p>
            <p>
              <strong>Avec un compte :</strong>{" "}vos CV, lettres, candidatures et offres sauvegardées
              sont en plus répliqués sur nos serveurs (Supabase, hébergement dans l&apos;Union
              européenne) pour être disponibles sur vos autres appareils. Des règles d&apos;accès au
              niveau de la base garantissent que seul votre compte peut lire vos données.
            </p>
            <p>
              Dans les deux cas, le contenu que vous soumettez à une fonctionnalité IA est transmis au
              fournisseur d&apos;IA le temps du traitement. Le détail figure dans notre{" "}
              <Link href="/confidentialite">politique de confidentialité</Link>.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Si je change d'ordinateur, est-ce que je retrouve mes CV ?">
            <p>
              <strong>Si vous avez un compte</strong>, oui : connectez-vous et vos documents sont
              retrouvés automatiquement.
            </p>
            <p>
              <strong>Sans compte</strong>, non : vos données vivent dans le navigateur de cette
              machine uniquement. Changer d&apos;ordinateur, de navigateur, ou vider les données de
              navigation vous ferait tout perdre. Pensez à exporter une sauvegarde, ou créez un compte.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Combien de requêtes IA sont incluses ?">
            <p>
              Chaque compte dispose d&apos;un quota mensuel de requêtes IA offert, qui se
              réinitialise au début de chaque mois calendaire. Le compteur restant s&apos;affiche dans
              le menu utilisateur, en haut à droite.
            </p>
            <p>
              Les actions principales (adapter un CV, générer ou adapter une lettre, importer un CV
              PDF, discuter avec l&apos;assistant) consomment un crédit. L&apos;analyse ATS et
              l&apos;extraction d&apos;une offre depuis une URL sont gratuites. Pour un usage
              illimité, renseignez votre propre clé API.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Pourquoi et comment utiliser ma propre clé API (IA) ?">
            <p>
              Renseigner votre propre clé (Google Gemini ou Anthropic) vous affranchit
              totalement du quota : les requêtes sont facturées sur votre compte fournisseur, pas sur
              le nôtre. C&apos;est aussi la seule façon d&apos;utiliser l&apos;IA sans créer de compte
              CVMatchr. Une clé Gemini gratuite s&apos;obtient en quelques clics sur Google AI Studio.
            </p>
            <button type="button" className="go" onClick={() => promptApiKey()} style={{ marginTop: 12 }}>
              Régler ma clé API
            </button>
          </FaqAccordion>

          <FaqAccordion question="Qu'est-ce que le « CV Principal » ?">
            <p>
              C&apos;est votre CV le plus complet, contenant toute votre expérience sans limite de
              pages. Quand vous adaptez votre CV à une offre, l&apos;IA y puise et élague le superflu
              pour tenir sur une page. Vous l&apos;activez en cochant « Utiliser le CV Principal »
              dans la fenêtre d&apos;adaptation.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Comment l'IA choisit-elle ce qu'elle garde dans mon CV ?">
            <p>
              Lorsque vous fournissez une offre d&apos;emploi, l&apos;IA analyse les mots-clés et les
              compétences requises. Elle puise ensuite dans votre « CV Principal » pour ne conserver
              et ne mettre en valeur que les expériences directement pertinentes pour ce poste, tout
              en s&apos;assurant que le résultat final tienne sur une seule page.
            </p>
            <p>
              Relisez toujours le résultat avant de l&apos;envoyer : l&apos;IA peut se tromper ou
              reformuler maladroitement.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Puis-je modifier la couleur ou le design du CV ?">
            <p>
              Le choix se fait parmi quatre modèles éprouvés (Sobre, Graphique, Kakuna, Marine).
              Il n&apos;y a volontairement pas de personnalisation libre : chaque modèle a été pensé
              pour rester lisible et pour passer les logiciels de tri automatique de CV (ATS).
              L&apos;objectif est que vous vous concentriez sur le contenu, pas sur la mise en page.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Où sont enregistrées les offres d'emploi que j'ajoute ?">
            <p>
              Dans l&apos;onglet « Offres » de l&apos;application. Vous pouvez vous en servir comme
              d&apos;un tableau de bord pour suivre l&apos;état de vos candidatures. Comme le reste,
              elles sont synchronisées si vous avez un compte, et locales à votre navigateur sinon.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Quelle est la différence entre le Formulaire et le mode Expert ?">
            <p>
              Le <strong>Formulaire</strong>{" "}(recommandé) vous laisse remplir des champs simples. Le
              mode <strong>Expert</strong>{" "}affiche les mêmes données au format <strong>JSON</strong>,
              et permet de les copier ou de les coller en bloc. Utile pour sauvegarder rapidement un
              document ou le transférer, sans passer par l&apos;interface.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Puis-je utiliser CVMatchr sur mon téléphone ?">
            <p>
              L&apos;application est accessible sur mobile pour dépanner (relire un document,
              consulter vos offres), mais <strong>nous recommandons vivement un ordinateur</strong>.
              L&apos;édition d&apos;un CV et la prévisualisation PDF nécessitent un écran large pour
              être confortables.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Comment garder une sauvegarde rapide de mon CV ?">
            <p>
              Passez en mode <strong>Expert</strong>{" "}et cliquez « Copier » pour copier le JSON de
              votre CV. Sur Windows, le raccourci <strong>Windows + V</strong>{" "}ouvre l&apos;historique
              du presse-papier : vous pouvez y épingler cette entrée (icône 📌) et la retrouver plus
              tard, même après avoir fermé votre navigateur. Une sauvegarde de secours en deux clics.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Quels sont les raccourcis clavier utiles ?">
            <ul className="help-list">
              <li><strong>Ctrl+Entrée</strong> → exporter en PDF</li>
              <li><strong>Ctrl+Maj+S</strong> → ouvrir les Snapshots</li>
            </ul>
          </FaqAccordion>

        </section>

        <section className="help-section">
          <h2>Une question sans réponse ?</h2>
          <p>
            Écrivez-nous à <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>.
          </p>
          <p style={{ marginTop: 12 }}>
            <Link href="/confidentialite">Politique de confidentialité</Link>
            {" · "}
            <Link href="/conditions-utilisation">Conditions d&apos;utilisation</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
