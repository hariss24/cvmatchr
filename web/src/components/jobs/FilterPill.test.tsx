/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FilterPill } from "./FilterPill";

describe("FilterPill", () => {
  afterEach(() => cleanup());

  it("affiche son nom seul quand elle ne contraint rien", () => {
    render(<FilterPill label="Contrat" value=""><p>menu</p></FilterPill>);
    const pill = screen.getByRole("button", { name: /Contrat/ });
    expect(pill).not.toHaveClass("is-set");
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("affiche sa valeur et passe en actif quand elle contraint", () => {
    render(<FilterPill label="Contrat" value="CDI, CDD"><p>menu</p></FilterPill>);
    expect(screen.getByText("CDI, CDD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contrat/ })).toHaveClass("is-set");
  });

  it("ouvre et referme le menu au clic", () => {
    render(<FilterPill label="Contrat" value=""><p>menu</p></FilterPill>);
    const pill = screen.getByRole("button", { name: /Contrat/ });
    expect(pill).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("menu")).toBeInTheDocument();
    fireEvent.click(pill);
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("referme sur Échap", () => {
    render(<FilterPill label="Contrat" value=""><p>menu</p></FilterPill>);
    fireEvent.click(screen.getByRole("button", { name: /Contrat/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("referme au clic à l'extérieur", () => {
    render(<div><FilterPill label="Contrat" value=""><p>menu</p></FilterPill><button>ailleurs</button></div>);
    fireEvent.click(screen.getByRole("button", { name: /Contrat/ }));
    fireEvent.mouseDown(screen.getByText("ailleurs"));
    expect(screen.queryByText("menu")).not.toBeInTheDocument();
  });

  it("garde le menu ouvert quand on clique dedans", () => {
    render(<FilterPill label="Contrat" value=""><button>option</button></FilterPill>);
    fireEvent.click(screen.getByRole("button", { name: /Contrat/ }));
    fireEvent.mouseDown(screen.getByText("option"));
    expect(screen.getByText("option")).toBeInTheDocument();
  });
});
