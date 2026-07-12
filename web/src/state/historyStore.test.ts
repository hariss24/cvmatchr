import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore, type DocumentSnapshot } from "./historyStore";

function snap(html: string): DocumentSnapshot {
  return { json: {} as DocumentSnapshot["json"], html, css: "", templateId: "sobre" };
}

beforeEach(() => {
  useHistoryStore.setState({ past: [], future: [], isTracking: true });
});

describe("historyStore", () => {
  it("push empile dans past et vide future", () => {
    const s = useHistoryStore.getState();
    s.push(snap("A"));
    s.push(snap("B"));
    const st = useHistoryStore.getState();
    expect(st.past.map((p) => p.html)).toEqual(["A", "B"]);
    expect(st.future).toEqual([]);
  });

  it("push ignore un état identique au précédent", () => {
    const s = useHistoryStore.getState();
    s.push(snap("A"));
    s.push(snap("A"));
    expect(useHistoryStore.getState().past).toHaveLength(1);
  });

  it("push est ignoré quand le tracking est en pause", () => {
    const s = useHistoryStore.getState();
    s.pause();
    s.push(snap("A"));
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });

  it("undo retourne l'état précédent et bascule l'état courant dans future", () => {
    const s = useHistoryStore.getState();
    s.push(snap("A"));
    const restored = s.undo(snap("B"));
    expect(restored?.html).toBe("A");
    const st = useHistoryStore.getState();
    expect(st.past).toHaveLength(0);
    expect(st.future.map((f) => f.html)).toEqual(["B"]);
  });

  it("undo retourne null quand past est vide", () => {
    expect(useHistoryStore.getState().undo(snap("B"))).toBeNull();
  });

  it("redo rejoue l'état futur et le remet dans past", () => {
    const s = useHistoryStore.getState();
    s.push(snap("A"));
    s.undo(snap("B")); // future = [B], past = []
    const redone = s.redo(snap("A"));
    expect(redone?.html).toBe("B");
    const st = useHistoryStore.getState();
    expect(st.past.map((p) => p.html)).toEqual(["A"]);
    expect(st.future).toHaveLength(0);
  });

  it("redo retourne null quand future est vide", () => {
    expect(useHistoryStore.getState().redo(snap("A"))).toBeNull();
  });

  it("un nouveau push après un undo efface la branche future (redo impossible)", () => {
    const s = useHistoryStore.getState();
    s.push(snap("A"));
    s.undo(snap("B")); // future = [B]
    s.push(snap("C")); // doit vider future
    expect(useHistoryStore.getState().future).toEqual([]);
    expect(s.redo(snap("C"))).toBeNull();
  });

  it("clear vide past et future", () => {
    const s = useHistoryStore.getState();
    s.push(snap("A"));
    s.clear();
    const st = useHistoryStore.getState();
    expect(st.past).toEqual([]);
    expect(st.future).toEqual([]);
  });
});
