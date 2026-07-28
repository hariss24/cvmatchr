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

  // Ce test est le garde-fou de la refonte : chaque réglage encore vivant doit
  // rester atteignable, sinon on perd des fonctionnalités en silence en croyant
  // ne changer que l'affichage.
  it("expose les huit réglages du panneau", () => {
    render(<MoreFilters profile={EMPTY_PROFILE} onChange={() => {}} />);
    for (const label of [
      /Vos compétences/, /Mots à exclure/, /Mots-clés à inclure/, /Codes ROME/,
      /Salaire minimum/, /Période/, /Qualification/, /Adresse de départ/,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  // Les réglages de la notation IA ont disparu avec elle. Ce test empêche
  // qu'un contrôle qui ne pilote plus rien réapparaisse par copier-coller.
  it("n'expose plus les réglages de la notation IA", () => {
    render(<MoreFilters profile={EMPTY_PROFILE} onChange={() => {}} />);
    for (const label of [/Score minimum/, /Offres notées/, /Résumé candidat/]) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
  });

  it("remonte une modification", () => {
    const onChange = vi.fn();
    render(<MoreFilters profile={EMPTY_PROFILE} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Salaire minimum/), { target: { value: "32000" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ salaireMin: 32000 }));
  });
});
