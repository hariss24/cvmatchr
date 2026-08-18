/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import JobCard from "./JobCard";
import type { JobEntry } from "@/lib/storage/db";

const base: JobEntry = {
  id: "1", createdAt: 0, title: "Webmaster F/H", company: "ACME",
  location: "Paris", commute: "28 min en transport", score: 91,
  url: "https://ex.fr/1", jobText: "Une description", status: "new", seen: false,
  source: "jsearch", logoUrl: "", boardDomain: "fr.linkedin.com", boardName: "LinkedIn",
  contractLabel: "CDI · Plein temps", salaryLabel: "33–36 k€ / an",
};

const noop = () => {};
const handlers = { onAdapt: noop, onApply: noop, onTrack: noop, onDismiss: noop, onSeen: noop };

const entry = (p: Partial<JobEntry> = {}): JobEntry => ({
  ...base,
  ...p,
});

const carte = (e: JobEntry) => (
  <JobCard job={e} {...handlers} />
);

describe("JobCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche titre, entreprise et faits", () => {
    render(<JobCard job={base} {...handlers} />);
    expect(screen.getByText("Webmaster F/H")).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("CDI · Plein temps")).toBeInTheDocument();
    expect(screen.getByText("33–36 k€ / an")).toBeInTheDocument();
  });

  // Annoncer « Salaire non précisé » occupe une ligne pour ne rien apprendre :
  // la puce disparaît au lieu de meubler.
  it("tait ce qui est inconnu au lieu de l'annoncer", () => {
    render(<JobCard job={{ ...base, contractLabel: "", salaryLabel: "" }} {...handlers} />);
    expect(screen.queryByText(/non précisé/i)).toBeNull();
    expect(screen.getByText("Paris")).toBeInTheDocument();
  });

  it("affiche le logo résolu à la recherche", () => {
    render(<JobCard job={{ ...base, logoUrl: "https://l/acme.png" }} {...handlers} />);
    expect(screen.getByTestId("job-logo-img")).toHaveAttribute("src", "https://l/acme.png");
  });

  it("retombe sur l'initiale sans logo, et si l'image ne charge pas", () => {
    const { rerender } = render(<JobCard job={base} {...handlers} />);
    expect(screen.getByTestId("job-logo-initial")).toHaveTextContent("A");

    rerender(<JobCard job={{ ...base, logoUrl: "https://l/casse.png" }} {...handlers} />);
    fireEvent.error(screen.getByTestId("job-logo-img"));
    expect(screen.getByTestId("job-logo-initial")).toHaveTextContent("A");
  });

  // La lettre sert au tri, pas à l'étiquetage : elle reste en base mais ne
  // s'affiche plus. C'est l'ordre de la liste qui porte l'information.
  it("n'affiche aucune lettre de classement", () => {
    render(<JobCard job={base} {...handlers} />);
    expect(screen.queryByTestId("job-grade")).toBeNull();
  });

  it("n'expose que deux actions, le reste dans le menu", () => {
    render(<JobCard job={base} {...handlers} />);
    expect(screen.getByTestId("job-adapt")).toBeInTheDocument();
    expect(screen.getByText("Voir l'offre")).toBeInTheDocument();
    expect(screen.queryByTestId("job-apply")).toBeNull();
    fireEvent.click(screen.getByTestId("job-menu-toggle"));
    expect(screen.getByTestId("job-apply")).toBeInTheDocument();
    expect(screen.getByTestId("job-track")).toBeInTheDocument();
    expect(screen.getByTestId("job-dismiss")).toBeInTheDocument();
  });

  it("déclenche l'action principale", () => {
    const onAdapt = vi.fn();
    render(<JobCard job={base} {...handlers} onAdapt={onAdapt} />);
    fireEvent.click(screen.getByTestId("job-adapt"));
    expect(onAdapt).toHaveBeenCalledWith(base);
  });

  it("déplie la description", () => {
    render(<JobCard job={base} {...handlers} />);
    const card = screen.getByTestId("job-card");
    expect(card.className).not.toContain("is-open");
    fireEvent.click(screen.getByText("Voir plus"));
    expect(screen.getByTestId("job-card").className).toContain("is-open");
    expect(screen.getByText("Voir moins")).toBeInTheDocument();
  });

  it("marque une offre déjà suivie", () => {
    render(<JobCard job={{ ...base, applicationId: "app-1" }} {...handlers} />);
    fireEvent.click(screen.getByTestId("job-menu-toggle"));
    expect(screen.getByTestId("job-track")).toBeDisabled();
  });
});

describe("JobCard — classement", () => {
  afterEach(() => cleanup());

  // Ni lettre ni score : la carte n'affiche aucune note, dans un sens comme dans
  // l'autre. Le rang dans la liste est la seule expression du classement.
  it("n'affiche ni lettre ni score chiffré", () => {
    render(carte(entry({ grade: "A", score: 78 })));
    expect(screen.queryByTestId("job-grade")).toBeNull();
    expect(screen.queryByText("/100")).not.toBeInTheDocument();
    expect(screen.queryByText("78")).not.toBeInTheDocument();
  });

  it("affiche le détail par critère quand il existe", () => {
    render(carte(entry({
      grade: "A",
      breakdown: [
        { key: "metier", label: "Métier", points: 20, max: 20, reason: "Développeur web (métier cible)" },
        { key: "distance", label: "Distance", points: 15, max: 15, reason: "8 km à vol d'oiseau" },
      ],
    })));
    expect(screen.getByTestId("job-why")).toHaveTextContent("Développeur web (métier cible)");
    expect(screen.getByTestId("job-why")).toHaveTextContent("8 km");
  });

  it("n'affiche aucun détail pour une offre antérieure", () => {
    render(carte(entry({ score: 78 })));
    expect(screen.queryByTestId("job-why")).not.toBeInTheDocument();
  });

  it("masque les lignes de malus sans motif", () => {
    render(carte(entry({
      grade: "A",
      breakdown: [
        { key: "metier", label: "Métier", points: 20, max: 20, reason: "cible" },
        { key: "signaux", label: "Signaux négatifs", points: 0, max: 0, reason: "" },
      ],
    })));
    expect(screen.getByTestId("job-why")).not.toHaveTextContent("Signaux négatifs");
  });
});

describe("JobCard — critereEntree", () => {
  afterEach(() => cleanup());

  it("affiche la mention si critereEntree est présent et différent du titre", () => {
    render(carte(entry({
      title: "Senior Software Engineer",
      critereEntree: "développeur",
    })));
    const el = screen.getByTestId("job-critere");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("Trouvée via : « développeur »");
  });

  it("n'affiche pas la mention si critereEntree est absent", () => {
    render(carte(entry({
      title: "Senior Software Engineer",
      critereEntree: undefined,
    })));
    expect(screen.queryByTestId("job-critere")).toBeNull();
  });

  it("n'affiche pas la mention si critereEntree est vide", () => {
    render(carte(entry({
      title: "Senior Software Engineer",
      critereEntree: "   ",
    })));
    expect(screen.queryByTestId("job-critere")).toBeNull();
  });

  it("n'affiche pas la mention si critereEntree est identique au titre", () => {
    render(carte(entry({
      title: "Développeur",
      critereEntree: "développeur",
    })));
    expect(screen.queryByTestId("job-critere")).toBeNull();
  });
});

