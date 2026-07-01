This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Variables d'environnement

À placer dans `web/.env.local` (dev, non versionné) et dans les variables Vercel (prod) :

| Variable | Rôle | Requise pour |
|---|---|---|
| `GEMINI_API_KEY` | Clé Google Gemini (IA) | Adaptation CV, chat, ATS, notation d'offres |
| `AUTH_PASSWORD` / `REMOTE_AUTH_PASSWORD` | Protège l'accès par mot de passe (facultatif) | Restreindre l'accès à l'app |
| `FT_CLIENT_ID` | Identifiant client France Travail (OAuth) | **Onglet Offres** (recherche) |
| `FT_CLIENT_SECRET` | Secret client France Travail | **Onglet Offres** (recherche) |
| `GOOGLE_MAPS_API_KEY` | Clé Google Maps (Distance Matrix) | **Onglet Offres** (temps de trajet) |

Sans les trois dernières, l'onglet **Offres** affiche un message de configuration au lieu de rechercher.
Le modèle Gemini se règle via `GEMINI_MODEL` (défaut : `gemini-3.1-flash-lite`).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
