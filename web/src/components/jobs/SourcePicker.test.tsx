/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SourcePicker } from "./SourcePicker";

const value = { francetravail: true, adzuna: false, jsearch: false };
const usage = { francetravail: 0, adzuna: 947, jsearch: 183 };

describe("SourcePicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("affiche les trois sources", () => {
    render(<SourcePicker value={value} onChange={() => {}} usage={usage} />);
    expect(screen.getByLabelText(/France Travail/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Google for Jobs/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Adzuna/)).toBeInTheDocument();
  });

  it("montre le quota consommé, « illimité » pour France Travail", () => {
    render(<SourcePicker value={value} onChange={() => {}} usage={usage} />);
    expect(screen.getByText("illimité")).toBeInTheDocument();
    expect(screen.getByText("183/200 ce mois")).toBeInTheDocument();
    expect(screen.getByText("947/1000 ce mois")).toBeInTheDocument();
  });

  it("bascule une source", () => {
    const onChange = vi.fn();
    render(<SourcePicker value={value} onChange={onChange} usage={usage} />);
    fireEvent.click(screen.getByLabelText(/Adzuna/));
    expect(onChange).toHaveBeenCalledWith({ francetravail: true, adzuna: true, jsearch: false });
  });

  it("reflète l'état coché", () => {
    render(<SourcePicker value={value} onChange={() => {}} usage={usage} />);
    expect(screen.getByLabelText(/France Travail/)).toBeChecked();
    expect(screen.getByLabelText(/Adzuna/)).not.toBeChecked();
  });
});
