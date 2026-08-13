import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { resumeSchema } from "@/lib/resume/schema";
import { DEFAULT_RESUME } from "@/lib/resume/defaults";
import { ResumeDocument, type PdfTemplateId } from "./ResumeDocument";
import { extractPdfText } from "./extractText";

/** PNG 1×1 transparent — vérifie que le rendu de la photo (data URI) ne plante pas. */
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function textOf(resume = DEFAULT_RESUME): Promise<string> {
  const buf = await renderToBuffer(
    <ResumeDocument resume={resume} templateId="graphique" />,
  );
  expect(Buffer.from(buf.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  const pages = await extractPdfText(new Uint8Array(buf));
  return pages.join("\n");
}

const TEMPLATE_IDS = ["graphique", "sobre", "kakuna", "marine"] as const;

describe("ResumeDocument (template graphique)", () => {
  it("rend le CV par défaut : identité, sections et contenus clés", async () => {
    const text = await textOf();

    // En-tête (le nom est rendu en majuscules dans le template graphique).
    expect(text).toContain("PRÉNOM NOM");
    expect(text).toContain("Titre du poste");
    expect(text).toContain("email@example.com");
    expect(text).toContain("linkedin.com/in/profil");

    // À propos.
    expect(text).toContain("Bref résumé professionnel");

    // Sections (titres en majuscules) et contenus.
    expect(text).toContain("EXPÉRIENCES");
    expect(text).toContain("Réalisation marquante avec métrique chiffrée.");
    expect(text).toContain("Entreprise");
    expect(text).toContain("Stage");
    expect(text).toContain("FORMATIONS");
    expect(text).toContain("Diplôme");
    expect(text).toContain("COMPÉTENCES");
    expect(text).toContain("Compétence 1");
    expect(text).toContain("LANGUES");
    expect(text).toContain("Français");
    expect(text).toContain("Natif");
    expect(text).toContain("CENTRES D'INTÉRÊT");
    expect(text).toContain("Lecture");
  });

  it("filtre les sections vides (mêmes règles que le rendu HTML)", async () => {
    const text = await textOf(resumeSchema.parse({ name: "Jean Test" }));

    expect(text).toContain("JEAN TEST");
    expect(text).not.toContain("EXPÉRIENCES");
    expect(text).not.toContain("FORMATIONS");
    expect(text).not.toContain("COMPÉTENCES");
    expect(text).not.toContain("LANGUES");
    expect(text).not.toContain("CENTRES D'INTÉRÊT");
    expect(text).not.toContain("PROJETS");
    expect(text).not.toContain("CERTIFICATIONS");
    expect(text).not.toContain("BÉNÉVOLAT");
  });

  // GARDE-FOU « ZÉRO PERTE » — le contrat central de l'app.
  //
  // Un modèle ne doit JAMAIS avaler une donnée du CV : c'est au modèle de s'adapter au CV,
  // pas au CV de rentrer dans les cases du modèle. Historiquement Marine ne rendait ni les
  // compétences, ni les projets, ni les certifications, ni le bénévolat, et les 3 autres
  // ignoraient soft skills et outils — silencieusement.
  //
  // Ce test rend RÉELLEMENT chaque modèle avec un CV où tout est rempli (y compris une
  // section inventée que personne dans le code ne connaît), relit le texte du PDF produit,
  // et exige que chaque valeur y figure. Un modèle qui laisse tomber un champ échoue ici.
  const FULL_RESUME = resumeSchema.parse({
    name: "Jean Test",
    title: "Chef de projet",
    summary: "Profil resumetest.",
    experience: [
      { title: "PosteTest", company: "EntrepriseTest", contract: "CDI", location: "LieuTest", date: "2024", bullets: ["RealisationTest"] },
    ],
    education: [{ title: "DiplomeTest", school: "EcoleTest", location: "VilleTest", date: "2020" }],
    skills: ["CompetenceTest"],
    softSkills: ["SoftSkillTest"],
    tools: ["OutilTest"],
    languages: [{ name: "LangueTest", level: "NiveauTest" }],
    interests: ["InteretTest"],
    projects: [{ title: "ProjetTest", date: "2023", description: "DescriptionProjetTest" }],
    certifications: ["CertifTest"],
    volunteer: [{ title: "BenevolatTest", organization: "AssoTest", location: "LieuBenevolatTest", date: "2022", bullets: ["MissionTest"] }],
    customSections: [
      { title: "Publications", items: ["PublicationTest"] },
      { title: "Distinctions", items: ["DistinctionTest"] },
    ],
    customFields: [
      { label: "Permis", value: "PermisTest" },
      { label: "Portfolio", value: "PortfolioTest" },
    ],
  });

  /** Chaque valeur du CV ci-dessus doit ressortir dans le PDF, quel que soit le modèle. */
  const MUST_APPEAR = [
    "Profil resumetest.",
    "PosteTest", "EntrepriseTest", "RealisationTest",
    "DiplomeTest", "EcoleTest",
    "CompetenceTest", "SoftSkillTest", "OutilTest",
    "LangueTest", "InteretTest",
    "ProjetTest", "DescriptionProjetTest",
    "CertifTest",
    "BenevolatTest", "AssoTest", "MissionTest",
    "PublicationTest", "DistinctionTest",
    // Infos personnelles hors cases : un permis ou un portfolio n'a aucun champ dédié,
    // et ne doit pas pour autant être jeté à l'import.
    "PermisTest", "PortfolioTest",
  ];

  it.each(TEMPLATE_IDS)(
    "n'avale aucune donnée du CV (modèle %s)",
    async (templateId: PdfTemplateId) => {
      const buf = await renderToBuffer(<ResumeDocument resume={FULL_RESUME} templateId={templateId} />);
      const pdf = (await extractPdfText(new Uint8Array(buf))).join("\n").toLowerCase();

      // Comparaison insensible à la casse : certains modèles capitalisent (Marine écrit
      // l'entreprise et l'école en majuscules). C'est du style, pas une perte de donnée —
      // ce qu'on exige ici, c'est que le CONTENU soit là.
      const missing = [...MUST_APPEAR, "Publications", "Distinctions"].filter(
        (v) => !pdf.includes(v.toLowerCase()),
      );
      expect(missing, `${templateId} : données absentes du PDF`).toEqual([]);
    },
  );

  // GARDE-FOU « MASQUER N'EST PAS SUPPRIMER » — les deux moitiés du contrat.
  //
  // Masquer doit retirer la section du PDF (sinon le bouton ne sert à rien) ET laisser son
  // contenu intact dans le CV (sinon c'est une suppression déguisée, et l'utilisateur perd
  // son travail sans l'avoir demandé). On vérifie les deux.
  it.each(TEMPLATE_IDS)(
    "retire du PDF une section masquée, sans toucher à son contenu (modèle %s)",
    async (templateId: PdfTemplateId) => {
      const masque = resumeSchema.parse({
        ...FULL_RESUME,
        hiddenSections: ["skills", "custom:0"], // Compétences + « Publications »
      });
      const buf = await renderToBuffer(<ResumeDocument resume={masque} templateId={templateId} />);
      const pdf = (await extractPdfText(new Uint8Array(buf))).join("\n").toLowerCase();

      expect(pdf, `${templateId} : la section masquée est encore rendue`).not.toContain("competencetest");
      expect(pdf, `${templateId} : la section libre masquée est encore rendue`).not.toContain("publicationtest");

      // Le reste du CV est toujours là : masquer une section n'en emporte pas d'autres.
      expect(pdf).toContain("postetest");
      expect(pdf).toContain("distinctiontest");

      // Et surtout : le contenu masqué n'a pas été effacé du CV.
      expect(masque.skills).toEqual(["CompetenceTest"]);
      expect(masque.customSections[0].items).toEqual(["PublicationTest"]);
    },
  );

  // GARDE-FOU « ORDRE » — le CV commande la mise en page, pas l'inverse.
  //
  // `sectionOrder` vient soit de l'IA (qui recopie l'ordre du CV importé), soit des flèches
  // du formulaire. Un modèle n'a plus le droit d'imposer son ordre : on le vérifie sur le
  // PDF réellement produit, en remontant une section normalement placée tout en bas.
  it.each(TEMPLATE_IDS)(
    "respecte l'ordre des sections demandé (modèle %s)",
    async (templateId: PdfTemplateId) => {
      const reordered = resumeSchema.parse({
        ...FULL_RESUME,
        // « Distinctions » (custom:1) est normalement la toute dernière section.
        sectionOrder: ["custom:1", "experience", "summary"],
      });
      const buf = await renderToBuffer(<ResumeDocument resume={reordered} templateId={templateId} />);
      const pdf = (await extractPdfText(new Uint8Array(buf))).join("\n").toLowerCase();

      const distinction = pdf.indexOf("distinctiontest");
      const experience = pdf.indexOf("postetest");
      const resume = pdf.indexOf("profil resumetest");

      expect(distinction, `${templateId} : « Distinctions » absent`).toBeGreaterThanOrEqual(0);
      expect(distinction, `${templateId} : « Distinctions » n'est pas remonté en tête`).toBeLessThan(experience);
      expect(experience, `${templateId} : « Expériences » ne précède pas l'accroche`).toBeLessThan(resume);
    },
  );

  it("met en gras la partie gauche d'une compétence « Mot clé — Description »", async () => {
    const text = await textOf(
      resumeSchema.parse({
        name: "X",
        skills: ["Power BI — Tableaux de bord et DAX", "Autonomie"],
      }),
    );
    // Les deux moitiés sont présentes (le gras est un style, l'extraction voit le texte).
    expect(text).toContain("Power BI");
    expect(text).toContain("Tableaux de bord et DAX");
    expect(text).toContain("Autonomie");
  });

  it("rend les sections optionnelles quand elles sont remplies", async () => {
    const text = await textOf(
      resumeSchema.parse({
        name: "X",
        projects: [{ title: "Projet Alpha", date: "2025", description: "Un projet." }],
        certifications: ["Certif AWS"],
        volunteer: [
          {
            title: "Tuteur",
            organization: "Assoc",
            location: "Paris",
            date: "2024",
            bullets: ["Accompagnement hebdomadaire."],
          },
        ],
      }),
    );
    expect(text).toContain("PROJETS");
    expect(text).toContain("Projet Alpha");
    expect(text).toContain("CERTIFICATIONS");
    expect(text).toContain("Certif AWS");
    expect(text).toContain("BÉNÉVOLAT");
    expect(text).toContain("Accompagnement hebdomadaire.");
  });



  it("affiche le titre personnalisé d'une section renommée", async () => {
    const text = await textOf(
      resumeSchema.parse({
        name: "X",
        experience: [{ title: "Dev", company: "ACME", bullets: ["a"] }],
        sectionTitles: { experience: "Parcours professionnel" },
      }),
    );
    expect(text.toLowerCase()).toContain("parcours professionnel");
    expect(text).not.toContain("EXPÉRIENCES");
  });

  it("Marine : le titre personnalisé prime sur son libellé par défaut « Profil »", async () => {
    const buf = await renderToBuffer(
      <ResumeDocument
        resume={resumeSchema.parse({ name: "X", summary: "Accroche.", sectionTitles: { summary: "Mon résumé" } })}
        templateId="marine"
      />,
    );
    const pdf = (await extractPdfText(new Uint8Array(buf))).join("\n").toLowerCase();
    expect(pdf).toContain("mon résumé");
    expect(pdf).not.toContain("profil");
  });

  it("ne plante pas avec une photo en data URI", async () => {
    const text = await textOf(resumeSchema.parse({ name: "Avec Photo", photo: PNG_1PX }));
    expect(text).toContain("AVEC PHOTO");
  });
});

describe("non-régression des templates non concernés par le rendu compact", () => {
  /** 25 compétences courtes : le cas qui déclenchera le mode tags chez Marine. */
  const CV_LISTES_COURTES = resumeSchema.parse({
    name: "Jean Test",
    skills: ["Git", "AWS", "Azure", "Docker", "Linux", "Python", "SQL", "Shell"],
    tools: ["2G", "3G", "4G", "5G", "Jira", "CI/CD", "Ansible", "Grafana"],
  });

  // Sobre, Kakuna et Graphique ont leur propre gestion de largeur : le prop `compact`
  // ne doit JAMAIS leur être passé. Ce test échoue si quelqu'un l'active par mégarde.
  for (const templateId of ["sobre", "kakuna", "graphique"] as const) {
    it(`${templateId} rend toutes les compétences sans changer de mise en page`, async () => {
      const buf = await renderToBuffer(
        <ResumeDocument resume={CV_LISTES_COURTES} templateId={templateId} />,
      );
      const pages = await extractPdfText(new Uint8Array(buf));
      const text = pages.join("\n");

      for (const item of [...CV_LISTES_COURTES.skills, ...CV_LISTES_COURTES.tools]) {
        expect(text, `« ${item} » perdu par ${templateId}`).toContain(item);
      }
      expect(pages).toHaveLength(1);
    });
  }
});

describe("Marine — sidebar au format « Catégorie — éléments »", () => {
  it("conserve l'intégralité du texte d'un outil catégorisé", async () => {
    const cv = resumeSchema.parse({
      name: "Jean Test",
      tools: ["Cloud & DevOps — Docker, Kubernetes, Ansible, AWS, Azure"],
    });
    const buf = await renderToBuffer(<ResumeDocument resume={cv} templateId="marine" />);
    const text = (await extractPdfText(new Uint8Array(buf))).join("\n");

    // SkillText scinde la chaîne en deux <Text> : les deux moitiés doivent survivre.
    expect(text).toContain("Cloud & DevOps");
    expect(text).toContain("Docker, Kubernetes, Ansible, AWS, Azure");
  });
});

describe("Marine — listes d'éléments courts", () => {
  /**
   * Reproduction du CV réel qui a fait remonter le bug : un ingénieur SRE, sorti en 2
   * pages dont la seconde ne portait qu'une ligne. Ce n'est pas la liste d'outils seule
   * qui déborde — c'est l'accumulation d'une colonne principale pleine (expérience,
   * formation, résumé) ET d'une sidebar déroulée sur 25 lignes qui pousse la dernière
   * section sur une 2e page quasi vide.
   */
  const CV_SRE_COMPLET = resumeSchema.parse({
    name: "Jean Test",
    title: "Ingénieur SRE",
    location: "Paris, France",
    email: "jean.test@example.com",
    phone: "06 12 34 56 78",
    linkedin: "linkedin.com/in/jean-test",
    summary:
      "Ingénieur SRE avec plus de 5 ans d'expérience dans la conception et l'exploitation " +
      "de plateformes critiques à forte disponibilité. Spécialisé dans l'automatisation " +
      "d'infrastructure, la supervision et la réponse aux incidents pour des systèmes " +
      "d'alerte publique et des réseaux télécoms. Habitué à travailler en astreinte sur des " +
      "environnements Kubernetes et cloud multi-fournisseurs.",
    experience: [
      {
        title: "Site Reliability Engineer",
        company: "Alerting Systems Corp",
        contract: "CDI",
        location: "Paris, France",
        date: "2022 — Présent",
        bullets: [
          "Development and integration of backend features for a critical public alerting platform serving millions of users.",
          "Design and maintenance of CI/CD pipelines using Jenkins and Ansible to automate deployment across staging and production.",
          "Migration of legacy infrastructure to Kubernetes, reducing deployment time by 40% and improving service resilience.",
          "On-call rotation covering incident response, root cause analysis and post-mortem documentation for critical outages.",
          "Implementation of monitoring and alerting dashboards with Grafana and Prometheus to track SLA compliance in real time.",
          "Collaboration with network engineering teams on 4G/5G infrastructure integration for emergency broadcast systems.",
          "Automation of infrastructure provisioning on AWS and Azure using Terraform, cutting manual configuration errors significantly.",
        ],
      },
      {
        title: "DevOps Engineer",
        company: "TelecomWorks",
        contract: "CDI",
        location: "Lyon, France",
        date: "2019 — 2022",
        bullets: [
          "Deployment and configuration of network equipment from Huawei and Ericsson for regional telecom operators.",
          "Development of internal tooling in Python and Shell to streamline configuration management across data centers.",
          "Administration of Linux servers and Git-based version control workflows for a team of twelve engineers.",
          "Support for 2G/3G network upgrades, coordinating with field technicians to minimize service disruption.",
        ],
      },
    ],
    education: [
      {
        title: "Master en Ingénierie Réseaux et Télécommunications",
        school: "École Centrale de Lyon",
        location: "Lyon, France",
        date: "2017 — 2019",
      },
      {
        title: "Licence en Informatique",
        school: "Université Claude Bernard Lyon 1",
        location: "Lyon, France",
        date: "2014 — 2017",
      },
    ],
    softSkills: ["Rigueur", "Communication", "Esprit d'équipe"],
    tools: [
      "PyTorch", "Python", "Shell", "SQL", "Git", "Linux", "Jenkins", "Ansible",
      "CI/CD", "Docker", "Kubernetes", "Jira", "Grafana", "Prometheus", "AWS",
      "Azure", "2G", "3G", "4G", "5G", "Huawei", "Ericsson", "Terraform",
      "Vault", "Consul",
    ],
    skills: [
      "Machine Learning", "Data Analysis", "KPI Optimization", "JSON",
      "version control", "network config", "KPI dashboards", "service debugging",
      "Incident Response", "Capacity Planning", "Load Testing", "Root Cause Analysis",
      "Automation Scripting",
    ],
    languages: [
      { name: "Français", level: "Natif" },
      { name: "Anglais", level: "Courant" },
      { name: "Espagnol", level: "Intermédiaire" },
    ],
  });

  it("tient sur une seule page malgré une sidebar de 25 outils et 13 compétences", async () => {
    const buf = await renderToBuffer(
      <ResumeDocument resume={CV_SRE_COMPLET} templateId="marine" />,
    );
    const pages = await extractPdfText(new Uint8Array(buf));
    expect(pages).toHaveLength(1);
  });

  it("ne perd aucun outil ni aucune compétence en passant en tags", async () => {
    const buf = await renderToBuffer(
      <ResumeDocument resume={CV_SRE_COMPLET} templateId="marine" />,
    );
    const text = (await extractPdfText(new Uint8Array(buf))).join("\n");
    for (const item of [...CV_SRE_COMPLET.tools, ...CV_SRE_COMPLET.skills]) {
      expect(text, `« ${item} » perdu`).toContain(item);
    }
  });

  it("ne perd rien quand les compétences sont catégorisées", async () => {
    const cv = resumeSchema.parse({
      name: "Jean Test",
      skills: [
        "Réseau — TCP/IP, HTTP/HTTPS, DNS, TLS, firewalls, tcpdump",
        "Cloud & DevOps — Docker, Kubernetes, Ansible, AWS, Azure, CI/CD",
      ],
    });
    const buf = await renderToBuffer(<ResumeDocument resume={cv} templateId="marine" />);
    const text = (await extractPdfText(new Uint8Array(buf))).join("\n");
    expect(text).toContain("TCP/IP, HTTP/HTTPS, DNS, TLS, firewalls, tcpdump");
    expect(text).toContain("Docker, Kubernetes, Ansible, AWS, Azure, CI/CD");
  });
});
