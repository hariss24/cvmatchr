/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ChatPanel from "./ChatPanel";
import { useDocStore } from "@/state/docStore";

describe("ChatPanel — bascule de prévisualisation", () => {
  beforeEach(() => {
    useDocStore.setState({
      json: { name: "Document original" } as any,
      previewOverride: null,
      docType: "CV",
      templateId: "sobre",
    });
  });

  afterEach(() => cleanup());

  it("rend le panneau fermé de manière inerte quand open est false", () => {
    render(<ChatPanel open={false} onClose={() => {}} />);
    const panel = screen.getByRole("dialog", { hidden: true });
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });
});
