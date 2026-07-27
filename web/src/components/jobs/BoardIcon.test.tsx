/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { BoardIcon } from "./BoardIcon";

describe("BoardIcon", () => {
  afterEach(() => {
    cleanup();
  });
  it("demande le favicon du domaine le plus précis d'abord", () => {
    render(<BoardIcon domain="candidat.francetravail.fr" name="France Travail" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src", expect.stringContaining("domain=candidat.francetravail.fr"));
  });

  it("descend d'un label quand le favicon échoue", () => {
    render(<BoardIcon domain="candidat.francetravail.fr" name="France Travail" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src", expect.stringContaining("domain=francetravail.fr"));
  });

  it("retombe sur l'initiale une fois la cascade épuisée", () => {
    render(<BoardIcon domain="acme.fr" name="Acme Jobs" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("affiche directement l'initiale sans domaine exploitable", () => {
    render(<BoardIcon domain="" name="Acme Jobs" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("affiche « ? » quand même le nom est vide", () => {
    render(<BoardIcon domain="" name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
