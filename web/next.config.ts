import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le dépôt parent contient son propre lockfile (app Flask) ; on fixe la racine
  // du workspace sur web/ pour que Turbopack ne remonte pas d'un cran.
  turbopack: { root: __dirname },
};

export default nextConfig;
