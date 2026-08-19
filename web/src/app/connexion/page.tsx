import FormulaireConnexion from "@/components/auth/FormulaireConnexion";

export const metadata = {
  title: "Connexion — CVMatchr",
};

export default function PageConnexion() {
  return (
    <main className="connexion-page">
      <FormulaireConnexion />
    </main>
  );
}
