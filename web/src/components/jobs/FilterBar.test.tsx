/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EMPTY_PROFILE } from "@/lib/jobs/profile";
import { FilterBar } from "./FilterBar";

const usage = { francetravail: 0, adzuna: 0, jsearch: 0, boards: 0 };
const base = {
  profile: EMPTY_PROFILE, onChange: () => {}, usage,
  resultCount: 0, canScan: false, scanning: false, onScan: () => {},
};

describe("FilterBar", () => {
  afterEach(() => cleanup());

  it("s'annonce comme « Filtres »", () => {
    render(<FilterBar {...base} />);
    expect(screen.getByLabelText("Filtres")).toBeInTheDocument();
  });

  it("affiche les cinq pastilles et « Plus de filtres »", () => {
    render(<FilterBar {...base} />);
    for (const n of [/Contrat/, /Publiée depuis/, /Expérience/, /Temps de travail/, /source/, /Plus de filtres/]) {
      expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
    }
  });

  it("désarme « Rechercher » sans poste renseigné", () => {
    render(<FilterBar {...base} />);
    expect(screen.getByRole("button", { name: /Rechercher/ })).toBeDisabled();
  });

  it("lance la recherche quand un poste est renseigné", () => {
    const onScan = vi.fn();
    render(<FilterBar {...base} canScan onScan={onScan} />);
    fireEvent.click(screen.getByRole("button", { name: /Rechercher/ }));
    expect(onScan).toHaveBeenCalled();
  });

  it("affiche le nombre d'offres retenues", () => {
    render(<FilterBar {...base} resultCount={28} />);
    expect(screen.getByText(/28/)).toBeInTheDocument();
  });

  it("montre « Réinitialiser » seulement quand un filtre contraint", () => {
    render(<FilterBar {...base} />);
    expect(screen.queryByRole("button", { name: /Réinitialiser/ })).not.toBeInTheDocument();
    cleanup();
    render(<FilterBar {...base} profile={{ ...EMPTY_PROFILE, maxAgeDays: 7 }} />);
    expect(screen.getByRole("button", { name: /Réinitialiser/ })).toBeInTheDocument();
  });

  it("réinitialise les filtres sans toucher au poste", () => {
    const onChange = vi.fn();
    const p = { ...EMPTY_PROFILE, keywords: ["Webmaster"], maxAgeDays: 7 };
    render(<FilterBar {...base} profile={p} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Réinitialiser/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxAgeDays: 30, keywords: ["Webmaster"] }));
  });
});
