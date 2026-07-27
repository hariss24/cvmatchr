/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EMPTY_PROFILE } from "@/lib/jobs/profile";
import { MoreFilters } from "./MoreFilters";

describe("MoreFilters", () => {
  afterEach(() => cleanup());

  // Ce test est le garde-fou de la refonte : chaque réglage de l'ancien
  // formulaire doit rester atteignable, sinon on perd des fonctionnalités
  // en silence en croyant ne changer que l'affichage.
  it("expose les onze réglages du panneau", () => {
    render(<MoreFilters profile={EMPTY_PROFILE} onChange={() => {}} />);
    for (const label of [
      /Compétences/, /Mots à exclure/, /Mots-clés à inclure/, /Codes ROME/,
      /Salaire minimum/, /Période/, /Qualification/, /Score minimum/,
      /Offres notées/, /Adresse de départ/, /Résumé candidat/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("remonte une modification", () => {
    const onChange = vi.fn();
    render(<MoreFilters profile={EMPTY_PROFILE} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Score minimum/), { target: { value: "85" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minScore: 85 }));
  });
});
