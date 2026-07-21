"use client";

import Link from "next/link";
import { promptApiKey } from "@/lib/settings";
import { useState } from "react";

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
          <h1 className="help-title">Comment fonctionne CVMatchr ?</h1>
          <p className="help-desc">
            CVMatchr est conçu pour être simple, rapide, et <strong>100% privé</strong>. 
            Contrairement à la majorité des applications web, <strong>aucune de vos données personnelles n&apos;est envoyée sur un serveur distant</strong>.
            Vos CVs, lettres, et informations de profil sont stockés directement dans le stockage local de votre navigateur (IndexedDB).
          </p>
          <p className="help-desc">
            C&apos;est pour cette raison que vous n&apos;avez pas besoin de créer de compte ou de vous connecter.
            Vos données vous appartiennent.
          </p>
        </section>

        <section className="help-section">
          <h2>Foire Aux Questions (FAQ)</h2>

          <FaqAccordion question="Comment démarrer rapidement en 4 étapes ?">
            <ol className="help-steps">
              <li>Importe ton CV (PDF ou texte) avec « Importer un PDF », ou pars du modèle par défaut.</li>
              <li>Complète les champs dans le formulaire.</li>
              <li>Clique « Adapter à une offre », colle l&apos;annonce : l&apos;IA adapte ton CV.</li>
              <li>Exporte en PDF (bouton en haut, ou Ctrl+Entrée).</li>
            </ol>
          </FaqAccordion>

          <FaqAccordion question="Qu'est-ce que le « CV Maître » ?">
            <p>
              C&apos;est ton CV le plus complet (contenant toute ton expérience sans limite de pages). 
              Quand tu adaptes à une offre, l&apos;IA y pioche et élague le superflu pour tenir sur une page. 
              Tu l&apos;actives en cochant « Utiliser le CV Maître » dans la fenêtre d&apos;adaptation.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Comment l'IA choisit-elle ce qu'elle garde dans mon CV ?">
            <p>
              Lorsque tu fournis une offre d&apos;emploi, l&apos;IA analyse les mots-clés et les compétences requises. Elle puise ensuite dans ton « CV Maître » pour ne conserver et ne mettre en valeur que les expériences directement pertinentes pour ce poste, tout en s&apos;assurant que le résultat final tienne sur une seule page.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Puis-je modifier la couleur ou le design du CV ?">
            <p>
              Non, et c&apos;est volontaire. Le design de CVMatchr a été méticuleusement pensé pour être sobre, ultra-lisible, et parfaitement optimisé pour passer les logiciels de tri de CV automatiques (ATS). L&apos;objectif est que tu te concentres à 100% sur ton contenu, sans perdre de temps sur la mise en page.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Si je change d'ordinateur, est-ce que je retrouve mes CV ?">
            <p>
              Étant donné que CVMatchr respecte totalement ta vie privée et stocke tout directement dans ton navigateur localement, tes données ne sont pas synchronisées sur un serveur. Si tu changes de machine ou de navigateur, tu devras réimporter ton CV existant (en PDF ou en texte).
            </p>
          </FaqAccordion>

          <FaqAccordion question="Où sont enregistrées les offres d'emploi que j'ajoute ?">
            <p>
              Toutes les offres sont sauvegardées dans l&apos;onglet « Offres » de l&apos;application (toujours localement sur ta machine). Tu peux t&apos;en servir comme d&apos;un tableau de bord pour suivre l&apos;état de tes candidatures (À postuler, En cours, Refusé...).
            </p>
          </FaqAccordion>

          <FaqAccordion question="Puis-je utiliser CVMatchr sur mon téléphone ?">
            <p>
              Bien que l&apos;application soit accessible sur mobile pour dépanner (lire un document ou consulter ses offres), <strong>nous conseillons fortement de l&apos;utiliser sur un ordinateur (PC/Mac)</strong>. L&apos;édition d&apos;un CV ou d&apos;une lettre et la prévisualisation PDF nécessitent un écran large pour une expérience optimale et un confort visuel maximal.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Pourquoi et comment utiliser ma propre clé API (IA) ?">
            <p>
              Par défaut, l&apos;app utilise une clé serveur partagée. Tu peux renseigner ta propre
              clé (Gemini ou Anthropic) pour ne pas dépendre du quota commun ni des limites de requêtes. Une clé Gemini gratuite
              s&apos;obtient sur Google AI Studio.
            </p>
            <button type="button" className="go" onClick={() => promptApiKey()} style={{ marginTop: 12 }}>
              Régler ma clé API
            </button>
          </FaqAccordion>

          <FaqAccordion question="Quelle est la différence entre le Formulaire et le mode Expert ?">
            <p>
              Le <strong>Formulaire</strong> (recommandé) te laisse remplir des champs simples. Le
              mode <strong>Expert</strong> montre le code : le <strong>JSON</strong> = tes données
              structurées, le <strong>HTML/CSS</strong> = la mise en page. Réservé aux usages avancés ou à des bidouillages poussés.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Astuce : comment garder une sauvegarde rapide de mon CV ?">
            <p>
              Sur Windows, le raccourci <strong>Windows + V</strong> ouvre l&apos;historique du presse-papier.
              Passe en mode <strong>Expert</strong>, clique « Copier » pour copier le JSON de ton CV, puis épingle
              cette entrée dans l&apos;historique du presse-papier (icône 📌). Tu pourras la retrouver et la recoller
              plus tard, même après avoir fermé ton navigateur : une sauvegarde de secours simple, sans rien exporter.
            </p>
          </FaqAccordion>

          <FaqAccordion question="Quels sont les raccourcis clavier utiles ?">
            <ul className="help-list">
              <li><strong>Ctrl+Entrée</strong> → exporter en PDF</li>
              <li><strong>Ctrl+Maj+S</strong> → ouvrir les Snapshots</li>
            </ul>
          </FaqAccordion>

        </section>
      </main>
    </div>
  );
}
