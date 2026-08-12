import Link from "next/link";
import BrandBadge from "@/components/layout/BrandBadge";

export const metadata = {
  title: "Conditions d'utilisation — CVMatchr",
  description: "Les règles d'utilisation du service CVMatchr.",
};

export default function ConditionsUtilisationPage() {
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
          <h1 className="help-title">Conditions d&apos;utilisation</h1>
          <p className="help-desc">
            Dernière mise à jour : 12 août 2026. CVMatchr est édité à titre individuel par
            Hariss Hafeji. Contact : <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>.
          </p>
        </section>

        <section className="help-section">
          <h2>Le service</h2>
          <p>
            CVMatchr est un éditeur de CV et de lettres de motivation avec adaptation par
            intelligence artificielle, recherche d&apos;offres d&apos;emploi et suivi de
            candidatures. L&apos;usage de base — édition, export PDF, mode invité — est gratuit et ne
            nécessite pas de compte.
          </p>
        </section>

        <section className="help-section">
          <h2>Compte et quota d&apos;IA</h2>
          <p>
            La création d&apos;un compte est optionnelle et permet de synchroniser vos documents
            entre appareils. Un quota mensuel de requêtes IA offertes est associé à chaque compte ;
            vous pouvez vous en affranchir en renseignant votre propre clé API dans les paramètres.
          </p>
          <p>
            Nous nous réservons le droit d&apos;ajuster ce quota ou d&apos;introduire des offres
            payantes à l&apos;avenir. Un tel changement ne s&apos;appliquerait pas rétroactivement aux
            documents que vous avez déjà créés, qui vous resteront accessibles et exportables.
          </p>
        </section>

        <section className="help-section">
          <h2>Propriété de votre contenu</h2>
          <p>
            Le contenu de vos CV, lettres et candidatures vous appartient. CVMatchr ne revendique
            aucun droit sur ces données au-delà de ce qui est strictement nécessaire pour fournir le
            service : les traiter, les stocker, et les transmettre au fournisseur d&apos;IA lorsque
            vous en faites la demande.
          </p>
        </section>

        <section className="help-section">
          <h2>Fiabilité de l&apos;IA</h2>
          <p>
            Les suggestions et adaptations générées par intelligence artificielle sont fournies à
            titre d&apos;aide et peuvent contenir des erreurs, des approximations ou des
            reformulations inexactes. <strong>Vous restez seul responsable de relire et de valider le
            contenu final</strong>{" "}de vos CV et lettres avant de les transmettre à un employeur.
          </p>
        </section>

        <section className="help-section">
          <h2>Usage acceptable</h2>
          <p>
            Vous vous engagez à ne pas utiliser CVMatchr pour produire du contenu frauduleux (faux
            diplômes, expériences fictives), à ne pas tenter de contourner le quota d&apos;IA par des
            moyens automatisés, et à ne pas perturber le fonctionnement du service.
          </p>
        </section>

        <section className="help-section">
          <h2>Disponibilité et responsabilité</h2>
          <p>
            CVMatchr est fourni « en l&apos;état », sans garantie de disponibilité continue. Le
            service peut être interrompu pour maintenance ou évoluer sans préavis. Nous ne saurions
            être tenus responsables d&apos;une perte de données, d&apos;une interruption de service,
            ou des conséquences liées à l&apos;usage du contenu généré — candidature refusée, erreur
            dans un CV non relu, entre autres.
          </p>
          <p>
            Nous vous recommandons de conserver une sauvegarde de vos documents importants, en
            particulier si vous utilisez le mode invité.
          </p>
        </section>

        <section className="help-section">
          <h2>Résiliation</h2>
          <p>
            Vous pouvez cesser d&apos;utiliser CVMatchr et demander la suppression de votre compte à
            tout moment en écrivant à{" "}
            <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>. Consultez la{" "}
            <Link href="/confidentialite">politique de confidentialité</Link> pour le détail de ce que
            cette suppression entraîne.
          </p>
        </section>

        <section className="help-section">
          <h2>Droit applicable</h2>
          <p>
            Ces conditions sont soumises au droit français. En cas de litige, une solution amiable
            sera recherchée en priorité.
          </p>
          <p style={{ marginTop: 12 }}>
            <Link href="/confidentialite">Politique de confidentialité</Link>
            {" · "}
            <Link href="/help">Aide</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
