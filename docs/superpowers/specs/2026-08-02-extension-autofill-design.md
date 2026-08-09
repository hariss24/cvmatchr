# Extension navigateur — autofill de candidature (Greenhouse / Lever)

> Spec de conception — 02/08/2026
> Traite la première ligne de `BACKLOG.md` § À planifier : « Manque fonctionnel —
> extension navigateur (capture d'offre + autofill de candidature) ». Constat source :
> `docs/archive/boucle/constats/2026-08-01-manques-fonctionnels.md` §1 — présente chez 7 des 8
> produits de référence, le manque le plus large mesuré à ce jour.

## 1. Problème

CVMatchr adapte un CV/lettre à une offre puis s'arrête à l'export PDF. Le candidat
doit ensuite recopier à la main nom, email, téléphone, LinkedIn et joindre le PDF
sur le site de l'entreprise (Greenhouse, Lever, Workday…) — la friction que 7 des 8
produits de référence éliminent avec une extension de navigateur. C'est, au sens du
seuil de `MISSION.md` (« aucune capacité présente chez ≥ 2 des produits de référence
et absente ici »), le manque fonctionnel le plus large mesuré depuis le début de la
boucle.

## 2. Ce qui est déjà couvert ailleurs (à ne pas refaire)

Le constat du 01/08 regroupe deux capacités sous une même ligne : **capture d'offre**
et **autofill de candidature**. Elles n'ont pas la même valeur ajoutée ici :

- **Capture d'offre** : CVMatchr a déjà un « extracteur magique d'offre »
  (`/api/extract-job`, `src/lib/scraper/`, modale `JobExtractor.tsx`) — coller une
  URL suffit, cascade fetch+cheerio → microservice Camoufox → Jina AI
  (`PROJECT_INDEX.md` §7). Une extension apporterait surtout d'éviter le
  copier-coller de l'URL — un gain réel mais marginal, pas un manque à 100 %.
- **Autofill de candidature** : CVMatchr n'a **aucun** équivalent. C'est le seul des
  deux axes où l'écart avec la concurrence est total.

**Décision : ce chantier ne couvre que l'autofill.** La capture d'offre par
extension reste une ligne distincte en `BACKLOG.md` § Idées (§8 de cette spec),
pour ne pas gonfler un chantier déjà qualifié de « lourd » par le constat source
avec une capacité à faible gain marginal.

## 3. Constats vérifiés le 02/08/2026 (consultation directe, sourcée)

- Champs du formulaire d'embarquement Greenhouse (documentation officielle de
  l'API, `https://github.com/grnhse/greenhouse-api-docs/blob/master/source/includes/job-board/_applications.md`,
  consultée le 02/08/2026) : champs texte `first_name`, `last_name`, `email`,
  `phone` ; pièces jointes `resume` et `cover_letter` (fichier) ; formulaire en
  `enctype="multipart/form-data"` ; questions personnalisées nommées
  `question_[ID]` (varient par offre, hors périmètre).
- Structure visible d'une offre Greenhouse réelle
  (`https://job-boards.greenhouse.io/thehonestcompanysandbox/jobs/140167`,
  consultée le 02/08/2026) : Prénom/Nom/Email obligatoires, Téléphone/Pays/Ville
  optionnels, CV et Lettre de motivation avec plusieurs méthodes de dépôt (fichier,
  Dropbox, Google Drive, saisie manuelle), LinkedIn, Site web, « Comment as-tu
  entendu parler de ce poste ? ». Confirme les champs de la doc API, mais
  **aucun identifiant HTML exact n'est visible depuis un rendu texte** (le
  formulaire est en grande partie rendu par script) — seule une inspection DOM en
  conditions réelles (navigateur, à l'implémentation) confirme si les noms
  documentés par l'API sont toujours ceux du DOM rendu aujourd'hui.
- Lever : le centre d'aide (`https://help.lever.co/hc/en-us/articles/20087243347741-Configuring-your-Lever-application-form`)
  confirme que **Nom complet et Email sont obligatoires par défaut**, les autres
  champs (téléphone, CV, LinkedIn) réglables par l'employeur — mais **aucune
  source publique consultée n'expose les noms/identifiants HTML exacts** des
  champs. Rejeté : deviner des sélecteurs Lever depuis l'entraînement du modèle
  serait la même erreur que ce dépôt refuse ailleurs (« rien n'est supposé, tout
  est mesuré », cf. specs zod/jobs). Voir §5.2 pour la conséquence sur la
  conception : un mécanisme générique, pas des sélecteurs codés en dur par ATS.

## 4. Ce que fait la concurrence (rappel du constat)

Jobscan, Rezi, Huntr, Enhancv, Careerflow, Simplify et une extension citée pour
Teal couvrent tous l'autofill, sur des dizaines d'ATS (Workday, Greenhouse, Lever,
iCIMS…). Aucun ne publie sa méthode technique exacte (code fermé) — cette spec ne
peut donc s'appuyer sur « comment ils font », seulement sur ce que les formulaires
eux-mêmes exposent publiquement (§3).

## 5. Décisions de conception

### 5.1 Portée : Greenhouse + Lever seulement, jamais de soumission automatique

**Retenu :** l'extension cible les formulaires Greenhouse et Lever. Elle **remplit**
les champs qu'elle reconnaît et **ne soumet jamais** le formulaire — le candidat
relit et clique lui-même sur « Envoyer ».

**Écarté explicitement : couvrir aussi Workday, iCIMS, SmartRecruiters, Taleo,
LinkedIn Easy Apply dès ce chantier.** Le constat source qualifie déjà ce chantier
de « lourd, hors périmètre d'un simple plan » ; Workday en particulier a un DOM
généré dynamiquement et propre à chaque client (`*.myworkdayjobs.com/<tenant>/...`),
sans structure commune documentée publiquement — l'ajouter sans pouvoir vérifier un
seul cas réel serait deviner, pas concevoir. Un ATS de plus est un chantier
additif, pas une réécriture, une fois le mécanisme validé sur les deux premiers en
usage réel (voir §8, ligne dédiée).

**Écarté explicitement : soumission automatique du formulaire.** Envoyer une
candidature sans relecture humaine est le genre d'erreur silencieuse qu'un
candidat ne pardonne pas (mauvaise offre, champ mal rempli, CV périmé) — le gain
(quelques secondes) ne couvre pas le risque.

### 5.2 Mécanisme de remplissage : reconnaissance générique, pas des sélecteurs figés par ATS

**Retenu :** un seul module de correspondance de champs
(`extension/lib/fieldMatch.js`), utilisé sur Greenhouse et sur Lever, qui
reconnaît un champ par, dans l'ordre :
1. Nom d'attribut HTML **documenté** pour Greenhouse (`first_name`, `last_name`,
   `email`, `phone`, `resume`, `cover_letter` — §3) ;
2. Attribut standard `autocomplete` (`given-name`, `family-name`, `email`, `tel`,
   `address-level2`) — un formulaire professionnel bien construit l'expose pour
   l'autofill natif du navigateur, indépendamment de l'ATS ;
3. Texte du `<label>` associé (mots-clés bilingues : « first name »/« prénom »,
   « last name »/« nom », « email »/« e-mail », « phone »/« téléphone »,
   « linkedin »), ou `placeholder` en dernier recours.

**Écarté explicitement : sélecteurs CSS/HTML figés par ATS (ex. deviner un
`div[data-qa="...")` pour Lever).** Rejeté par manque de preuve (§3) : un
sélecteur inventé qui se révèle faux en usage réel est pire qu'une reconnaissance
générique qui échoue proprement (aucun champ rempli, pas un mauvais champ rempli).
Le mécanisme générique est aussi ce qui permettra d'ajouter un futur ATS (§8) sans
nouvelle capacité de reconnaissance — seulement, au besoin, de nouveaux mots-clés
de libellé.

**Conséquence assumée :** la couverture Lever peut être incomplète au premier
usage réel (un champ non reconnu reste vide, l'utilisateur le complète à la main).
C'est un dégradé silencieux et sûr, pas un échec — cohérent avec l'absence de
soumission automatique (§5.1).

### 5.3 Transport des données : `chrome.storage.local`, sans service worker

**Retenu :** aucune arrière-plan (`background`) au sens Manifest V3. Trois scripts
de contenu suffisent :
- `content-bridge.js`, injecté sur `cvmatchr.fr` et `localhost:3000`, qui écoute un
  `window.postMessage` émis par la page CVMatchr et écrit le paquet reçu dans
  `chrome.storage.local` (les scripts de contenu ont un accès direct à
  `chrome.storage` dès que la permission `storage` est déclarée — pas besoin d'un
  relais `background`) ;
- `content-autofill.js`, injecté sur les pages Greenhouse/Lever, qui lit
  `chrome.storage.local`, affiche un bouton flottant si un paquet existe, et
  remplit les champs au clic.

**Écarté explicitement : un `background` service worker comme relais entre les
deux scripts de contenu.** Testé mentalement contre la documentation Chrome :
`chrome.storage` est accessible directement depuis un content script du moment que
la permission `"storage"` figure dans `manifest.json` — un relais n'ajouterait
qu'un aller-retour de message sans fonction propre. Simplicité d'abord.

**Écarté explicitement : une page d'options pour configurer l'URL de l'app.**
CVMatchr n'a qu'un seul déploiement connu (`https://cvmatchr.fr`, `README.md`) plus
le poste de développement (`http://localhost:3000`) — les deux origines sont
codées en dur dans les `matches` du manifeste. Une page d'options resterait un
champ jamais rempli par le seul utilisateur réel de ce dépôt aujourd'hui
(mono-utilisateur, `PROJECT_INDEX.md` §1).

### 5.4 Le PDF traverse le pont en base64, jamais par un service serveur

**Retenu :** le CV déjà généré côté client (`generateResumePdfBlob`,
`src/lib/pdfgen/generatePdf.tsx` — moteur unique, §6 de `PROJECT_INDEX.md`) est
converti en base64 et transporté dans le même paquet JSON que l'identité et la
lettre. Sur la page ATS, le script de contenu reconstruit un `File` (`Uint8Array`
→ `File`) et l'assigne à l'`<input type="file">` reconnu via un objet
`DataTransfer` — technique standard, déjà utilisée par les gestionnaires de mots
de passe et outils d'autofill du marché, qui fonctionne parce qu'un script de
contenu a un accès DOM complet à la page hôte.

**Taille vérifiée :** un CV react-pdf de ce dépôt (4 gabarits, une page) pèse
quelques centaines de Ko au format PDF ; en base64 (facteur ~1,33), il reste très
en dessous du quota par défaut de `chrome.storage.local` (10 Mo) — pas besoin de
la permission `unlimitedStorage`.

**Écarté explicitement : héberger le PDF sur un endpoint serveur temporaire et ne
transporter qu'une URL.** Ajouterait une route API, un stockage temporaire à
purger, une fenêtre de validité à gérer — pour un fichier qui tient très
confortablement dans `chrome.storage.local` local au navigateur. Complexité non
justifiée par la taille réelle du problème (Simplicity First).

### 5.5 Un seul paquet en mémoire, pas d'historique dans l'extension

**Retenu :** `chrome.storage.local` ne garde qu'**un seul** paquet
(« dernière préparation »), écrasé à chaque nouvel appel de « Préparer pour
l'extension ». Le tracker CVMatchr (`/candidatures`, `PROJECT_INDEX.md` §8 bis)
reste la seule source de vérité sur l'historique des candidatures ; l'extension
n'est qu'un tampon d'exécution éphémère entre deux pages.

**Écarté explicitement : un historique de paquets préparés dans l'extension**
(un par candidature, avec un sélecteur dans le popup). Dupliquerait, en moins
bien, ce que `/candidatures` fait déjà (statut dérivé, dédoublonnage) — et
introduirait une deuxième source de vérité sur les candidatures, contraire au
principe directeur du tracker (« le suivi ne doit rien coûter », donc rien à
gérer en double).

## 6. Architecture

### 6.1 Nouveau répertoire `extension/` (racine du dépôt, hors `web/`)

Sibling de `web/` et `scraper-service/` (précédent déjà établi dans ce dépôt pour
du code auxiliaire hors app Next.js) :

```
extension/
  manifest.json
  content-bridge.js          # injecté sur cvmatchr.fr + localhost:3000
  content-autofill.js        # injecté sur Greenhouse + Lever
  lib/fieldMatch.js           # reconnaissance générique de champ (§5.2)
  popup.html
  popup.js
  README.md                  # comment charger l'extension en mode développeur
```

**Aucune dépendance npm, aucun bundler.** JavaScript vanilla, Manifest V3, chargé
« non empaqueté » (`chrome://extensions` → mode développeur → « Charger
l'extension non empaquetée ») — pas de build, pas de publication sur le Chrome Web
Store dans ce chantier (§8). Conforme à `MISSION.md` : aucune dépendance npm
ajoutée, donc pas de chantier sous feu vert.

### 6.2 `web/src/` — le seul flux sortant (préparation), aucun flux entrant

Deux nouveaux fichiers, tous deux hors composant React (logique pure testable) :

- `web/src/lib/extension/autofillPackage.ts` — construit le paquet JSON (identité,
  texte de lettre, CV en base64) depuis les données déjà en mémoire de l'app.
  Fonction pure, testable par Vitest sans DOM.
- `web/src/lib/extension/bridge.ts` — `postAutofillPackage(pkg)` : émet le
  `window.postMessage` ciblé (`window.location.origin`, jamais `"*"`) et attend un
  accusé de réception (`chrome.storage.local` écrit) avec un délai de 800 ms ;
  renvoie `true`/`false` selon qu'une extension a répondu. Permet à l'UI de
  distinguer « préparé » de « extension absente ».

Un composant, `web/src/components/pack/ExtensionExportButton.tsx`, monté dans
`PackView.tsx` (page `/pack`, l'endroit où CV + lettre sont déjà assemblés pour
une candidature précise — voir `PROJECT_INDEX.md` §10) :
- visible dès qu'un CV est chargé (`isCv`) — la lettre est optionnelle (son texte,
  si absent, part vide, un champ de moins à remplir n'est pas bloquant) ;
- au clic : génère le PDF du CV courant (`generateResumePdfBlob`, gabarit courant
  du `docStore`), construit le paquet, l'envoie, affiche un toast de succès ou
  d'échec (« extension non détectée »).

**Aucune modification à `docStore.ts`, `db.ts` (Dexie) ni au moteur ATS.** Le
paquet se construit à la demande, à partir de données déjà présentes en mémoire —
zéro nouvelle persistance côté CVMatchr.

### 6.3 Format du paquet (contrat entre `web/src/` et `extension/`)

```ts
interface AutofillPackage {
  createdAt: number;
  company: string;
  role: string;
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
  };
  coverLetterText: string;
  resume: {
    filename: string;          // "CV_<poste>.pdf" (buildPdfFilename)
    mimeType: "application/pdf";
    base64: string;
  };
}
```

Champs sourcés depuis `resolveLetterIdentity(cv, profile)` (déjà utilisée par
`PackView.tsx` — profil prioritaire, repli sur le CV, `src/lib/profile/profile.ts`) :
`identity.prenom`/`identity.nom` → `firstName`/`lastName` ; `identity.cv.email`,
`.phone`, `.location`, `.linkedin` → le reste. Aucune nouvelle source de données.

### 6.4 Flux complet

```
Page /pack (CVMatchr, onglet A)
  ExtensionExportButton
    → generateResumePdfBlob(cv, templateId)   (moteur existant, inchangé)
    → buildAutofillPackage(...)                (nouveau, pur)
    → postAutofillPackage(pkg)
        → window.postMessage({ source: "cvmatchr-app", type: "...", payload }, origin)

content-bridge.js (même onglet A, injecté par l'extension sur cvmatchr.fr)
  → écoute le postMessage (origine + source vérifiées)
  → chrome.storage.local.set({ cvmatchrAutofillPackage: payload })
  → accusé : postMessage retour, lu par bridge.ts (résout la Promise à true)

Page Greenhouse ou Lever (onglet B, plus tard, même profil Chrome)
  content-autofill.js
    → chrome.storage.local.get("cvmatchrAutofillPackage")
    → si présent : bouton flottant « Remplir avec CVMatchr (Entreprise · Poste) »
    → au clic : fieldMatch.js localise chaque champ, remplit (setter natif +
      évènements `input`/`change` — nécessaire sur les champs contrôlés par React,
      qu'utilisent les embeds modernes de Greenhouse), CV joint via DataTransfer
    → jamais de soumission automatique (§5.1)
```

## 7. Tests et vérification

Deux univers de test distincts, cohérents avec ce que ce dépôt teste déjà ailleurs
(pas de `jsdom`/`fake-indexeddb`, `PROJECT_INDEX.md` §8 bis) :

1. **`web/src/lib/extension/autofillPackage.ts`** : Vitest, fonction pure, aucune
   API navigateur (le PDF arrive déjà en base64 depuis l'appelant — la conversion
   Blob→base64, elle-même deux lignes de glue, n'est pas testée séparément, comme
   les autres wrappers IO fins de ce dépôt ne le sont pas).
2. **`extension/`** : aucun exécuteur de test (pas de Node/Vitest configuré hors
   `web/`, et `fieldMatch.js` manipule le DOM d'une page tierce qu'aucun jsdom ne
   simule fidèlement). Vérification **manuelle**, documentée dans le plan : charger
   l'extension en mode développeur, ouvrir une vraie offre Greenhouse et une vraie
   offre Lever, préparer un paquet depuis `/pack`, constater les champs remplis.
   Un champ non reconnu (dégradé silencieux, §5.2) n'est pas un échec de ce
   chantier tant que les champs documentés (§3) le sont.

## 8. Hors périmètre (chantiers distincts, notés en `BACKLOG.md`)

- Capture d'offre par extension (§2) — gain marginal, l'extracteur URL existant
  couvre l'essentiel.
- Autofill sur d'autres ATS (Workday, iCIMS, SmartRecruiters, Taleo, LinkedIn Easy
  Apply) — un par un, une fois Greenhouse/Lever validés en usage réel (§5.1).
- Publication sur le Chrome Web Store — décision de distribution/légale distincte
  d'un choix technique ; mode développeur suffit à ce stade (un seul utilisateur
  réel aujourd'hui, `PROJECT_INDEX.md` §1).
- Firefox/Safari (WebExtensions `browser.*`) — aucune mesure d'usage navigateur
  des utilisateurs de CVMatchr ne justifie la double maintenance aujourd'hui.
- Remplissage des questions personnalisées Greenhouse (`question_[ID]`, varient
  par offre) et des questions Lever configurables par l'employeur — non
  génériques par nature, hors du mécanisme de reconnaissance de §5.2.

## 9. Critères de succès vérifiables

1. `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (depuis `web/`) passent,
   sans régression sur le nombre de tests verts, avec les nouveaux tests de
   `autofillPackage.ts` en plus.
2. Aucune dépendance npm ajoutée (vérifiable : `git diff web/package.json
   web/package-lock.json` vide).
3. `extension/manifest.json` valide (chargeable sans erreur via `chrome://extensions`
   → mode développeur → « Charger l'extension non empaquetée »).
4. Sur une offre Greenhouse réelle : après clic sur « Préparer pour l'extension »
   dans `/pack` puis sur le bouton flottant de la page Greenhouse, les champs
   Prénom/Nom/Email/Téléphone et la pièce jointe CV sont remplis avec les
   valeurs du paquet préparé.
5. Sur une offre Lever réelle : au moins Nom complet et Email (les deux champs
   obligatoires documentés par Lever, §3) sont remplis ; tout champ non reconnu
   reste vide sans erreur JavaScript visible en console.
6. Le formulaire n'est **jamais** soumis automatiquement par l'extension, sur
   aucune des deux plateformes.
7. Sans l'extension installée, cliquer sur « Préparer pour l'extension » affiche
   un message clair (« extension non détectée ») plutôt qu'un succès silencieux
   trompeur.

## 10. Limites connues

- Les sélecteurs Lever ne reposent sur aucune source publique confirmée (§3) — la
  reconnaissance générique (§5.2) est une réponse à cette incertitude, pas une
  élimination : la couverture réelle sur Lever ne se confirme qu'à l'usage.
- Un ATS change parfois son DOM sans préavis (aucune API de versionnement connue
  côté Greenhouse/Lever pour le rendu visuel) — un futur échec de reconnaissance
  n'est pas nécessairement une régression du code de ce chantier.
- Le paquet transite en clair dans `chrome.storage.local` (données personnelles :
  nom, email, téléphone, CV) — stockage local au navigateur de l'utilisateur
  uniquement, jamais transmis à un serveur, cohérent avec le modèle 100 % local de
  CVMatchr (`PROJECT_INDEX.md` §1) ; effacé à chaque nouvelle préparation (§5.5).
