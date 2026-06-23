import { describe, it, expect } from "vitest";
import { sseFromGenerator } from "./stream";

async function* fromValues(values: string[]): AsyncGenerator<string> {
  for (const v of values) yield v;
}

describe("sseFromGenerator", () => {
  it("émet chaque chunk en SSE puis [DONE]", async () => {
    const res = sseFromGenerator(fromValues(["a", "b"]));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toBe('data: "a"\n\ndata: "b"\n\ndata: [DONE]\n\n');
  });

  it("encode le JSON (échappe les sauts de ligne)", async () => {
    const res = sseFromGenerator(fromValues(["a\nb"]));
    const text = await res.text();
    expect(text).toBe('data: "a\\nb"\n\ndata: [DONE]\n\n');
  });

  it("émet [ERROR] si le générateur lève", async () => {
    async function* bad(): AsyncGenerator<string> {
      yield "a";
      throw new Error("boom");
    }
    const text = await sseFromGenerator(bad()).text();
    expect(text).toBe('data: "a"\n\ndata: [ERROR] boom\n\n');
  });
});
