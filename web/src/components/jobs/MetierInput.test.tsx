/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MetierInput } from "./MetierInput";

const FOUR = ["Webmaster", "chargé SEO", "Chargé de communication digitale", "Chargé de marketing digital"];

describe("MetierInput — repli des postes", () => {
  afterEach(() => cleanup());

  it("affiche tout tant qu'il y a deux postes ou moins", () => {
    render(<MetierInput values={["Webmaster", "chargé SEO"]} onChange={() => {}} />);
    expect(screen.getByText("Webmaster")).toBeInTheDocument();
    expect(screen.getByText("chargé SEO")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /postes masqués/ })).not.toBeInTheDocument();
  });

  it("ne montre que les deux derniers postes ajoutés au-delà de deux", () => {
    render(<MetierInput values={FOUR} onChange={() => {}} />);
    expect(screen.getByText("Chargé de communication digitale")).toBeInTheDocument();
    expect(screen.getByText("Chargé de marketing digital")).toBeInTheDocument();
    expect(screen.queryByText("Webmaster")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Afficher les 2 postes masqués/ })).toHaveTextContent("+2");
  });

  // Le point qui compte : un poste masqué doit rester supprimable, sinon on
  // enferme l'utilisateur avec un critère qu'il ne peut plus retirer.
  it("déplie au clic sur le compteur, et le poste masqué redevient supprimable", () => {
    const onChange = vi.fn();
    render(<MetierInput values={FOUR} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Afficher les 2 postes masqués/ }));
    expect(screen.getByText("Webmaster")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retirer Webmaster" }));
    expect(onChange).toHaveBeenCalledWith(["chargé SEO", "Chargé de communication digitale", "Chargé de marketing digital"]);
  });

  it("se replie de nouveau", () => {
    render(<MetierInput values={FOUR} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Afficher les 2 postes masqués/ }));
    fireEvent.click(screen.getByRole("button", { name: /Replier la liste des postes/ }));
    expect(screen.queryByText("Webmaster")).not.toBeInTheDocument();
  });
});
