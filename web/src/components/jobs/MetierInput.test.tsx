/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MetierInput } from "./MetierInput";

const FOUR = ["Webmaster", "chargé SEO", "Chargé de communication digitale", "Chargé de marketing digital"];

describe("MetierInput — affichage des postes", () => {
  afterEach(() => cleanup());

  it("affiche tous les postes saisis sans en masquer aucun", () => {
    render(<MetierInput values={FOUR} onChange={() => {}} />);
    expect(screen.getByText("Webmaster")).toBeInTheDocument();
    expect(screen.getByText("chargé SEO")).toBeInTheDocument();
    expect(screen.getByText("Chargé de communication digitale")).toBeInTheDocument();
    expect(screen.getByText("Chargé de marketing digital")).toBeInTheDocument();
  });

  it("permet de retirer n'importe quel poste en cliquante sur sa croix", () => {
    const onChange = vi.fn();
    render(<MetierInput values={FOUR} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Retirer Webmaster" }));
    expect(onChange).toHaveBeenCalledWith(["chargé SEO", "Chargé de communication digitale", "Chargé de marketing digital"]);
  });
});

describe("MetierInput — code ROME", () => {
  afterEach(() => cleanup());

  it("remonte le code ROME de l'appellation choisie", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ results: [{ label: "Développeur / Développeuse web", rome: "M1855" }] }),
    }) as unknown as typeof fetch;

    const onChange = vi.fn();
    const onRomeAdd = vi.fn();
    render(<MetierInput values={[]} onChange={onChange} onRomeAdd={onRomeAdd} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Poste recherché" }), {
      target: { value: "developpeur" },
    });
    const suggestion = await screen.findByText("Développeur / Développeuse web");
    fireEvent.click(suggestion);

    expect(onRomeAdd).toHaveBeenCalledWith("M1855");
    expect(onChange).toHaveBeenCalled();
  });

  it("n'exige pas le rappel : la saisie libre reste possible sans code", () => {
    const onChange = vi.fn();
    render(<MetierInput values={[]} onChange={onChange} />);
    const champ = screen.getByRole("textbox", { name: "Poste recherché" });
    fireEvent.change(champ, { target: { value: "webmarketing" } });
    fireEvent.keyDown(champ, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["webmarketing"]);
  });
});
