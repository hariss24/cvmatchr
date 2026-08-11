import Link from "next/link";

export const metadata = {
  title: "Conditions d'utilisation — CVMatchr",
};

export default function ConditionsUtilisationPage() {
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
          <h1 className="help-title">Conditions d&apos;utilisation</h1>
          <p className="help-desc">
            Dernière mise à jour : 11 août 2026. CVMatchr est édité à titre individuel par
            Hariss Hafeji, contact : <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>.
          </p>
        </section>

        <section className="help-section">
          <h2>Le service</h2>
          <p>
            CVMatchr est un éditeur de CV et de lettres de motivation avec adaptation par intelligence
            artificielle, recherche d&apos;offres d&apos;emploi et suivi de candidatures. L&apos;usage
            de base (édition, export PDF, mode invité) est gratuit et ne nécessite pas de compte.
          </p>
        </section>

        <section className="help-section">
          <h2>Compte et quota IA</h2>
          <p>
            La création d&apos;un compte (connexion Google) est optionnelle et permet de synchroniser tes
            documents entre appareils. Un quota mensuel de requêtes IA gratuites est associé à chaque
            compte ; il peut être contourné en renseignant ta propre clé API dans les paramètres. Nous
            nous réservons le droit d&apos;ajuster ce quota ou de proposer des offres payantes à l&apos;avenir,
            sans effet rétroactif sur les documents déjà créés.
          </p>
        </section>

        <section className="help-section">
          <h2>Propriété de ton contenu</h2>
          <p>
            Le contenu de tes CV, lettres et candidatures t&apos;appartient. CVMatchr ne revendique aucun
            droit sur ces données au-delà de ce qui est strictement nécessaire pour fournir le service
            (les traiter, les stocker, les transmettre au fournisseur IA à ta demande).
          </p>
        </section>

        <section className="help-section">
          <h2>Fiabilité de l&apos;IA</h2>
          <p>
            Les suggestions et adaptations générées par IA sont fournies à titre d&apos;aide et peuvent
            contenir des erreurs, approximations ou inexactitudes. Tu restes seul responsable de relire
            et valider le contenu final de tes CV et lettres avant de les envoyer à un employeur.
          </p>
        </section>

        <section className="help-section">
          <h2>Usage acceptable</h2>
          <p>
            Tu t&apos;engages à ne pas utiliser CVMatchr pour générer du contenu frauduleux (faux
            diplômes, fausses expériences), à ne pas tenter de contourner le quota IA par des moyens
            automatisés, et à ne pas perturber le fonctionnement du service.
          </p>
        </section>

        <section className="help-section">
          <h2>Disponibilité et responsabilité</h2>
          <p>
            CVMatchr est fourni « en l&apos;état », sans garantie de disponibilité continue. Nous ne
            saurions être tenus responsables d&apos;une perte de données, d&apos;une interruption de
            service, ou de conséquences liées à l&apos;usage du contenu généré (candidature refusée,
            erreur dans un CV non relu, etc.).
          </p>
        </section>

        <section className="help-section">
          <h2>Résiliation</h2>
          <p>
            Tu peux cesser d&apos;utiliser CVMatchr et demander la suppression de ton compte à tout
            moment en écrivant à <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a> —
            voir la <Link href="/confidentialite">politique de confidentialité</Link> pour le détail de
            ce que cela supprime.
          </p>
        </section>

        <section className="help-section">
          <h2>Droit applicable</h2>
          <p>Ces conditions sont soumises au droit français.</p>
        </section>
      </main>
    </div>
  );
}
