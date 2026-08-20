import Link from "next/link";
import BrandBadge from "@/components/layout/BrandBadge";

export const metadata = {
  title: "Politique de confidentialité — CVMatchr",
  description: "Comment CVMatchr traite vos données personnelles.",
};

export default function ConfidentialitePage() {
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
          <h1 className="help-title">Politique de confidentialité</h1>
          <p className="help-desc">
            Dernière mise à jour : 12 août 2026. CVMatchr est édité à titre individuel par
            Hariss Hafeji. Pour toute question relative à vos données :{" "}
            <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>.
          </p>
        </section>

        <section className="help-section">
          <h2>Deux façons d&apos;utiliser CVMatchr</h2>
          <p>
            <strong>Sans compte (mode invité)</strong> : vos CV, lettres, candidatures et offres sont
            stockés uniquement dans votre navigateur (IndexedDB), sur votre appareil. Rien n&apos;est
            conservé sur nos serveurs. Les seules données qui quittent votre navigateur sont celles
            que vous soumettez explicitement à une fonctionnalité IA (voir « Intelligence
            artificielle » ci-dessous), traitées à la volée sans être stockées de notre côté.
          </p>
          <p>
            <strong>Avec un compte (connexion Google, optionnelle)</strong> : vos documents sont en
            plus répliqués sur nos serveurs afin d&apos;être accessibles depuis plusieurs appareils.
            Le détail de ce qui est alors collecté figure ci-dessous.
          </p>
        </section>

        <section className="help-section">
          <h2>Données collectées si vous créez un compte</h2>
          <ul className="help-list">
            <li><strong>Identité</strong> : adresse e-mail, nom et photo de profil transmis par Google lors de la connexion.</li>
            <li><strong>Contenu</strong> : le texte de vos CV, lettres de motivation, candidatures suivies et offres sauvegardées.</li>
            <li><strong>Usage</strong> : un compteur du nombre de requêtes IA effectuées dans le mois, pour appliquer le quota offert.</li>
          </ul>
          <p>
            Ces données sont hébergées chez <strong>Supabase</strong>{" "}(base PostgreSQL, région Union
            européenne — Stockholm), protégées par des règles d&apos;accès au niveau de la base
            (Row Level Security) qui garantissent que seul votre compte peut lire ou modifier vos
            propres données.
          </p>
          <p>
            <strong>Base légale :</strong>{" "}l&apos;exécution du service que vous demandez, pour les
            données de compte et de contenu ; notre intérêt légitime à faire respecter le quota
            offert, pour les compteurs d&apos;usage.
          </p>
        </section>

        <section className="help-section">
          <h2>Intelligence artificielle</h2>
          <p>
            Lorsque vous utilisez une fonctionnalité IA (adaptation de CV, génération de lettre,
            analyse ATS…), le contenu concerné — CV, offre d&apos;emploi que vous avez collée — est
            envoyé au fournisseur d&apos;IA configuré pour être traité, puis la réponse vous est
            retournée. Par défaut ce fournisseur est <strong>Google (modèles Gemini)</strong>. Si vous
            renseignez votre propre clé API dans les paramètres, le contenu est envoyé au fournisseur
            correspondant à cette clé (Google ou Anthropic) à la place.
          </p>
          <p>
            Ce contenu n&apos;est pas conservé par CVMatchr au-delà du traitement de la requête. Il
            peut l&apos;être par le fournisseur d&apos;IA, selon sa propre politique de
            confidentialité — que nous vous invitons à consulter si vous traitez des informations
            sensibles.
          </p>
        </section>

        <section className="help-section">
          <h2>Autres services utilisés</h2>
          <ul className="help-list">
            <li><strong>Vercel</strong> : hébergement de l&apos;application, et mesure d&apos;audience anonymisée (sans cookies) via Vercel Analytics.</li>
            <li><strong>Resend</strong> : envoi des emails du compte — confirmation d&apos;adresse et réinitialisation de mot de passe. Votre adresse email lui est transmise à cette seule fin. Resend s&apos;appuie sur Amazon SES (région Irlande) pour l&apos;acheminement.</li>
            <li><strong>France Travail, Adzuna, JSearch</strong> : recherche d&apos;offres d&apos;emploi publiques. Aucune donnée personnelle ne leur est transmise, hormis les critères de recherche que vous saisissez (métier, ville).</li>
            <li><strong>Google Maps</strong> : calcul du temps de trajet entre une ville que vous indiquez et le lieu d&apos;une offre, à votre demande.</li>
            <li><strong>Brandfetch</strong> : récupération du logo d&apos;une entreprise à partir de son nom, pour l&apos;affichage des offres.</li>
          </ul>
        </section>

        <section className="help-section">
          <h2>Durée de conservation</h2>
          <p>
            Vos données de compte et vos documents sont conservés tant que votre compte existe. Ils
            sont supprimés définitivement lorsque vous demandez la suppression de votre compte. En
            mode invité, la durée de conservation dépend uniquement de votre navigateur : vider les
            données de navigation efface tout.
          </p>
        </section>

        <section className="help-section">
          <h2>Cookies</h2>
          <p>
            En mode invité, CVMatchr ne dépose aucun cookie de suivi. Si vous vous connectez, un
            cookie de session strictement nécessaire (géré par Supabase Auth) est utilisé pour vous
            maintenir connecté entre deux visites. Aucun cookie publicitaire ou de traçage tiers
            n&apos;est utilisé.
          </p>
        </section>

        <section className="help-section">
          <h2>Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification,
            d&apos;effacement, de portabilité et d&apos;opposition sur vos données. Pour l&apos;exercer,
            écrivez à <a href="mailto:hafejihariss@gmail.com">hafejihariss@gmail.com</a>. La
            suppression d&apos;un compte entraîne la suppression en cascade de l&apos;ensemble des
            données associées : profil, CV, lettres, candidatures et offres sauvegardées.
          </p>
          <p>
            Vous pouvez également introduire une réclamation auprès de la CNIL (
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>).
          </p>
        </section>

        <section className="help-section">
          <h2>Mineurs</h2>
          <p>CVMatchr ne s&apos;adresse pas aux personnes de moins de 15 ans.</p>
        </section>

        <section className="help-section">
          <h2>Modifications</h2>
          <p>
            Cette politique peut évoluer avec les fonctionnalités de CVMatchr. La date de dernière
            mise à jour en haut de cette page reflète la version en vigueur.
          </p>
          <p style={{ marginTop: 12 }}>
            <Link href="/conditions-utilisation">Conditions d&apos;utilisation</Link>
            {" · "}
            <Link href="/help">Aide</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
