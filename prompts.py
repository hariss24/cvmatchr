"""Prompts système et squelettes HTML pour les fonctions IA (consommés par app.py).

Contenu (constantes uniquement, aucune logique) :
- _CV_HTML_SKELETON / _LETTRE_SKELETON : gabarits HTML que l'IA doit remplir
  (classes CSS du template « sobre », cf. static/js/resume-form.js).
- _SYSTEM_CV_IMPORT / _SYSTEM_LETTRE_IMPORT : prompts d'import texte/PDF -> HTML.
- _PRESERVE_RULE / _ELAGUE_RULE : règles de préservation ou d'élagage du contenu.
- _TAILOR_SYSTEMS : prompts d'adaptation du CV à une offre, par niveau
  d'intensité (« peu », « adapte », « hyper »).
- _COMMON_HTML_RULES : règles HTML communes injectées dans tous les prompts.

Toute modification des classes CSS dans les squelettes doit rester synchrone
avec static/css/main.css et resume-form.js.
"""

_CV_HTML_SKELETON = """\
<div class="resume-template-1 resume-template-renderer">

  <section class="resume-template-renderer-section personal-data">
    <h2 class="resume-template-renderer-section__title">Informations personnelles</h2>
    <div class="personal-data__photo" style="background:#eee;">
      <!-- URL_DE_VOTRE_PHOTO_ICI -->
    </div>
    <div class="personal-data__title-row">
      <span class="personal-data__name">Prenom Nom</span><span class="personal-data__desired-job-title">Titre du poste</span>
    </div>
    <div class="personal-data__contact-row">
      Ville, Pays &middot; email@example.com &middot; +33 6 00 00 00 00 &middot; linkedin.com/in/profil
    </div></section>

  <section class="resume-template-renderer-section summary-objective">
    <h2 class="resume-template-renderer-section__title summary-objective__title">A propos</h2>
    <div class="summary-objective__content">
      Bref resume professionnel.
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Experience</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Poste occupe</span>
      <span class="entry-list__date">Jan 2024 - Present</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Entreprise</span><span class="entry-list__location">Ville</span>
      </div>
      <div class="entry-list__description">
        <ul>
          <li>Realisation.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Formation</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Diplome</span>
      <span class="entry-list__date">2020 - 2022</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Etablissement</span><span class="entry-list__location">Ville</span>
      </div>
      <div class="entry-list__description">
        <p>Description, specialites ou matieres principales.</p>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Competences</h2>
    <div class="plain-list__items">
      <span class="plain-list__item">Competence 1</span>
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Projets</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Nom du projet</span>
      <span class="entry-list__date">2024</span>
      <div class="entry-list__description">
        <p>Description du projet.</p>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Certifications</h2>
    <div class="plain-list__items">
      <span class="plain-list__item">Certification 1</span>
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Benevolat</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Role</span>
      <span class="entry-list__date">2023 - 2024</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Organisation</span><span class="entry-list__location">Ville</span>
      </div>
      <div class="entry-list__description">
        <ul>
          <li>Activite.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section languages">
    <h2 class="resume-template-renderer-section__title">Langues</h2>
    <div class="languages__items">
      <div class="languages__item">
        <span class="languages__name">Francais</span>
        <span class="languages__description">Natif</span>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Centres d'interet</h2>
    <div class="plain-list__items">
      <span class="plain-list__item">Interet 1</span>
    </div>
  </section>

</div>"""

_LETTRE_SKELETON = """\
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Lettre de Motivation</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Helvetica", "Arial", sans-serif; font-size: 9.5pt; line-height: 1.6; color: #333; padding: 48px 58px 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 36px; }
    .sender strong, .recipient strong { font-size: 10.5pt; color: #000; }
    .sender p, .recipient p { margin-top: 2px; color: #555; font-size: 9pt; }
    .recipient { text-align: right; }
    .subject { font-weight: 600; font-size: 9.5pt; color: #000; margin-bottom: 24px; border-bottom: 2px solid #c9c6c1; padding-bottom: 8px; }
    .salutation { margin-bottom: 16px; }
    .body p { margin-bottom: 16px; text-align: justify; }
    .closing { margin-top: 32px; }
    .closing p { margin-bottom: 6px; }
    .signature { margin-top: 24px; font-weight: 600; font-size: 10pt; color: #000; }
  </style>
</head>
<body>
  <div class="header">
    <div class="sender">
      <strong>Prenom Nom</strong>
      <p>Titre du poste</p>
      <p>Ville, Pays</p>
      <p>+33 6 00 00 00 00</p>
      <p>email@example.com</p>
    </div>
    <div class="recipient">
      <strong>A l'attention du responsable de recrutement</strong>
      <p>Ville, le JJ mois AAAA</p>
    </div>
  </div>
  <div class="subject">Objet : Candidature au poste de [Poste]</div>
  <div class="salutation">Madame, Monsieur,</div>
  <div class="body">
    <p>Paragraphe d'introduction.</p>
    <p>Paragraphe sur les competences et experiences.</p>
    <p>Paragraphe de conclusion.</p>
  </div>
  <div class="closing">
    <p>Je vous adresse mes sinceres salutations,</p>
  </div>
  <div class="signature">Prenom Nom</div>
</body>
</html>"""

_SYSTEM_CV_IMPORT = (
    "Tu reçois le contenu d'un CV (texte ou image). Remplis ce squelette HTML avec les données du CV fourni.\n\n"
    "RÈGLES — RESPECTE-LES À LA LETTRE :\n"
    "1. Conserve EXACTEMENT la structure HTML et toutes les classes CSS du squelette. Ne les modifie jamais.\n"
    "2. Remplace uniquement le contenu textuel par les données réelles du CV.\n"
    "3. Blocs répétables — inclus TOUS les éléments du CV, sans en omettre aucun :\n"
    "   • entry-list__item : un bloc par expérience, par diplôme, par projet, par activité bénévole\n"
    "     → Pour chaque diplôme/projet : inclus la description dans entry-list__description si présente dans le CV.\n"
    "     → Pour chaque expérience/bénévolat : inclus TOUTES les réalisations dans entry-list__description.\n"
    "   • plain-list__item : un <span> par compétence, par certification, par centre d'intérêt\n"
    "   • languages__item : un bloc par langue\n"
    "4. Si une section est absente du CV (pas de projets, pas de certifications, pas de bénévolat,\n"
    "   pas de centres d'intérêt, pas de résumé, pas de langues…), omets la section entière.\n"
    "5. Sous-éléments optionnels — si un sous-élément du squelette (entry-list__description, entry-list__company-row…)\n"
    "   n'a pas de contenu correspondant dans le CV, supprime entièrement cette balise.\n"
    "   Ne laisse jamais de balise vide ni de texte placeholder.\n"
    "6. N'ajoute AUCUNE balise <style>, AUCUN attribut style inline (sauf style=\"background:#eee;\" déjà présent).\n"
    "7. Laisse <!-- URL_DE_VOTRE_PHOTO_ICI --> exactement tel quel, sans le modifier.\n"
    "8. Retourne UNIQUEMENT le HTML rempli, sans balise markdown, sans commentaire, sans explication.\n\n"
    "Squelette à remplir :\n" + _CV_HTML_SKELETON
)

_SYSTEM_LETTRE_IMPORT = (
    "Tu reçois le contenu d'une lettre de motivation (texte ou image). Remplis ce squelette HTML.\n\n"
    "RÈGLES — RESPECTE-LES À LA LETTRE :\n"
    "1. Conserve EXACTEMENT la structure HTML, toutes les classes CSS, et la balise <style> du squelette.\n"
    "2. Remplace uniquement le contenu textuel par les données réelles de la lettre.\n"
    "3. Ne modifie PAS les styles CSS.\n"
    "4. Retourne le document HTML COMPLET (DOCTYPE inclus), sans markdown, sans commentaire.\n\n"
    "Squelette à remplir :\n" + _LETTRE_SKELETON
)

_PRESERVE_RULE = (
    "RÈGLE PRIMORDIALE — PRÉSERVATION INTÉGRALE : "
    "Tu dois retourner la TOTALITÉ du CV sans exception. "
    "Il est ABSOLUMENT INTERDIT de supprimer, omettre ou masquer une seule section, "
    "expérience, compétence, langue, formation ou centre d'intérêt présent dans le CV original. "
    "Chaque section du CV original doit être présente dans ta réponse. "
    "Tu adaptes le contenu — tu ne supprimes JAMAIS. "
)

_ELAGUE_RULE = (
    "RÈGLE DE SÉLECTION (CV MAÎTRE) : "
    "Tu reçois un CV 'Maître' exhaustif qui contient tout l'historique du candidat. "
    "Ton rôle est d'ÉLAGUER et de SÉLECTIONNER uniquement ce qui est pertinent pour l'offre d'emploi. "
    "Tu DOIS SUPPRIMER les expériences, compétences, ou projets qui n'ont aucun rapport avec le poste visé "
    "pour que le CV final soit concis, percutant et tienne sur 1 à 2 pages maximum. "
    "Conserve et mets en valeur ce qui est utile, retire le reste. "
)

_TAILOR_SYSTEMS = {
    "peu": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : SUBTIL (peu adapté). "
        "Tu peux UNIQUEMENT modifier : "
        "(1) le titre/tagline sous le nom (pour refléter le poste visé de façon générique) ; "
        "(2) la section résumé/accroche pour l'orienter vers ce type de poste avec 2-3 mots-clés naturels. "
        "Le résumé doit rester générique : il reflète le profil du candidat orienté vers ce type de poste, "
        "PAS une candidature spécifique à une entreprise. "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "INTERDIT : toucher aux compétences (ni en ajouter, ni en retirer, ni les réordonner), "
        "modifier les descriptions de postes ou les listes à puces des expériences, "
        "supprimer ou modifier les langues, les centres d'intérêt, la formation, "
        "les dates, les entreprises du parcours, les intitulés de poste. "
        "Le CV doit rester à 95% identique à l'original."
    ),
    "adapte": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : MODÉRÉ (adapté). "
        "Tu peux : "
        "(1) ajuster le titre/tagline sous le nom pour refléter le poste visé de façon générique ; "
        "(2) réécrire le résumé/accroche pour ce type de poste ; "
        "(3) réordonner les compétences existantes pour mettre les plus pertinentes en premier "
        "(SANS EN AJOUTER NI EN SUPPRIMER) ; "
        "(4) enrichir et reformuler les puces des expériences existantes (maximum 4 puces par expérience). "
        "Pour les puces : développe et enrichis ce qui est déjà écrit (ajoute contexte, métriques si disponibles "
        "dans le reste du CV), mais ne fabrique pas de contenu absent du CV original. "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "Le résumé doit rester générique : profil orienté vers ce type de poste, pas une candidature nominative. "
        "INTERDIT : inventer ou supprimer des compétences, "
        "toucher à la section langues (doit rester intacte avec TOUTES les langues listées), "
        "toucher à la section centres d'intérêt (doit rester intacte), "
        "modifier les dates, entreprises du parcours, intitulés de poste ou diplômes."
    ),
    "hyper": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : MAXIMUM (hyper-adapté). "
        "Tu peux : "
        "(1) ajuster le titre/tagline sous le nom pour refléter le poste visé de façon générique ; "
        "(2) réécrire complètement le résumé/accroche ; "
        "(3) réorganiser ET reformuler les compétences existantes pour maximiser la pertinence "
        "(SANS en inventer de nouvelles, uniquement celles déjà présentes dans le CV original) ; "
        "(4) réécrire entièrement les puces d'expériences pour aligner au maximum avec les mots-clés "
        "du poste (maximum 4 puces par expérience, sans fabriquer de contenu absent du CV). "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "Le résumé doit rester générique : profil orienté vers ce type de poste, pas une candidature nominative. "
        "ABSOLUMENT INTERDIT : "
        "supprimer la section langues ou retirer une seule langue (toutes doivent rester), "
        "supprimer ou modifier la section centres d'intérêt, "
        "inventer des compétences absentes du CV original, "
        "modifier les dates, entreprises du parcours, intitulés de poste, diplômes ou noms propres."
    ),
    "sur-mesure": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : SUR-MESURE (invention autorisée). "
        "Ton objectif est de rendre le CV le PLUS pertinent possible pour cette offre, quitte à "
        "embellir et inventer. Tu peux : "
        "(1) ajuster le titre/tagline sous le nom pour refléter le poste visé ; "
        "(2) réécrire complètement le résumé/accroche ; "
        "(3) AJOUTER des compétences demandées par l'offre même si elles sont absentes du CV original, "
        "et réorganiser le tout pour maximiser la pertinence ; "
        "(4) réécrire et ENRICHIR les puces d'expériences en ajoutant des réalisations, "
        "responsabilités et résultats chiffrés crédibles qui collent à l'offre, même s'ils ne "
        "figurent pas dans le CV original (maximum 5 puces par expérience). "
        "Reste crédible et cohérent avec le parcours (secteur, séniorité, dates). "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "Le résumé doit rester générique : profil orienté vers ce type de poste, pas une candidature nominative. "
        "INTERDIT : modifier les dates, les entreprises du parcours, les intitulés de poste ou les diplômes."
    ),
}

_COMMON_HTML_RULES = (
    "\n\nRÈGLES TECHNIQUES STRICTES (NON NÉGOCIABLES) :\n"
    "1. BALISES FIGÉES : Ne change JAMAIS le type d'une balise existante (ne transforme pas "
    "un <span> en <div>, un <td> en autre chose, etc.). N'ajoute JAMAIS de balise wrapper "
    "autour du contenu existant. N'invente JAMAIS de nouvelles classes CSS absentes du HTML reçu. "
    "Si tu dois ajouter un item (puce, compétence), utilise EXACTEMENT le même type de balise "
    "et les mêmes classes que les autres items du même niveau dans le HTML original. "
    "Conserve intégralement <html> (avec lang), <head>, toutes les balises <meta> et <link>.\n"
    "2. CSS INTOUCHABLE : Conserve la balise <style> et son contenu pixel pour pixel. "
    "Ne modifie AUCUNE classe CSS, AUCUN id, et aucun attribut style=\"...\". "
    "Le rendu visuel doit être identique à l'original.\n"
    "3. PHOTO DE PROFIL : Ne modifie jamais l'attribut src d'une balise <img>. "
    "Les src des images ont été remplacés par des placeholders du type "
    "[IMAGE_BASE64_0], [IMAGE_BASE64_1], etc. Recopie-les EXACTEMENT tels quels "
    "(avec les crochets, sans guillemets internes, sans modification).\n"
    "4. INTÉGRALITÉ DU CONTENU : Ne supprime AUCUNE expérience, compétence, langue, "
    "formation ou centre d'intérêt. Si le CV est long, reformule — n'efface JAMAIS. "
    "Chaque section présente dans le CV original doit exister dans ta réponse.\n"
    "5. ATTRIBUTS HTML : Conserve tous les attributs data-*, aria-* et autres attributs "
    "personnalisés exactement tels qu'ils sont dans le HTML reçu.\n"
    "6. RÉSUMÉ/ACCROCHE : Le texte de la section résumé ou accroche ('À propos', 'Profil', etc.) "
    "ne doit JAMAIS dépasser 400 mots. Si ta version dépasse cette limite, condense sans perdre "
    "les informations clés.\n"
    "7. COMMENTAIRES DE NAVIGATION : Si le HTML original ne contient pas déjà de commentaires "
    "de section, insère un commentaire HTML avant chaque <section> principale, "
    "au format <!-- ===== NOM DE LA SECTION ===== --> (nom en majuscules, en français). "
    "Si des commentaires existent déjà, conserve-les tels quels sans les modifier.\n"
    "8. ORDRE DES SECTIONS : Conserve les expériences et les formations DANS LE MÊME ORDRE que "
    "le HTML original. Ne les réordonne JAMAIS, ne les trie pas par pertinence : l'ordre "
    "chronologique d'origine doit être préservé à l'identique.\n"
    "9. RÉSUMÉ GÉNÉRIQUE : Dans le résumé/accroche, ne recopie pas les phrases ou expressions "
    "exactes de l'offre. Le résumé décrit le profil du candidat orienté vers ce TYPE de métier, "
    "pas une candidature à une offre précise. Évite l'effet 'CV taillé sur mesure'.\n"
    "10. FORMAT DE SORTIE : Retourne UNIQUEMENT le code HTML complet, du <!DOCTYPE html> "
    "jusqu'à </html>. Zéro bloc markdown (```html), zéro commentaire global, zéro texte avant ou après."
)
