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

describe("JobCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche titre, entreprise, score et faits", () => {
    render(<JobCard job={base} {...handlers} />);
    expect(screen.getByText("Webmaster F/H")).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("CDI · Plein temps")).toBeInTheDocument();
    expect(screen.getByText("33–36 k€ / an")).toBeInTheDocument();
  });

  it("dit explicitement ce qui est inconnu", () => {
    render(<JobCard job={{ ...base, contractLabel: "", salaryLabel: "" }} {...handlers} />);
    expect(screen.getByText("Type non précisé")).toBeInTheDocument();
    expect(screen.getByText("Salaire non précisé")).toBeInTheDocument();
  });

  it("affiche le logo d'entreprise quand il existe, sinon l'initiale", () => {
    const { rerender } = render(<JobCard job={{ ...base, logoUrl: "https://l/acme.png" }} {...handlers} />);
    expect(screen.getByAltText("ACME")).toBeInTheDocument();
    rerender(<JobCard job={base} {...handlers} />);
    expect(screen.queryByAltText("ACME")).toBeNull();
    expect(screen.getByTestId("job-logo-initial")).toHaveTextContent("A");
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
