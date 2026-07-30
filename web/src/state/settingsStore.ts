import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AiProvider = "gemini" | "anthropic";
export type AiModel =
  | "gemini-3.1-flash" // Défaut : voir le commentaire de `activeModel`
  | "gemini-3.1-flash-lite"
  | "gemini-1.5-pro"
  | "claude-haiku-4-5-20251001" // Default for Anthropic
  | "claude-3-5-sonnet";

export type AccentColor = "orange" | "blue" | "green" | "purple";

export type SettingsState = {
  // IA
  geminiKey: string;
  anthropicKey: string;
  activeModel: AiModel;
  creativity: number; // 0.0 to 1.0
  globalPrompt: string;
  
  // App
  language: string; // 'fr' | 'en'
  autosaveDelay: number; // 0 = manuel, 1000 = 1s, 5000 = 5s, 30000 = 30s
  accentColor: AccentColor;
  staleDays: number;
};

type SettingsActions = {
  setGeminiKey: (key: string) => void;
  setAnthropicKey: (key: string) => void;
  setActiveModel: (model: AiModel) => void;
  setCreativity: (val: number) => void;
  setGlobalPrompt: (prompt: string) => void;
  
  setLanguage: (lang: string) => void;
  setAutosaveDelay: (delay: number) => void;
  setAccentColor: (color: AccentColor) => void;
  setStaleDays: (days: number) => void;
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      geminiKey: "",
      anthropicKey: "",
      // `flash-lite` était le défaut, et il recopiait mot pour mot le modèle de ton
      // du prompt de lettre — jusqu'aux amorces de phrase que ce prompt lui interdit
      // explicitement. Toutes les lettres sortaient identiques. `flash` tient les
      // consignes négatives, pour un coût du même ordre.
      activeModel: "gemini-3.1-flash",
      creativity: 0.7,
      globalPrompt: "",

      language: "fr",
      autosaveDelay: 1000,
      accentColor: "orange",
      staleDays: 30,

      setGeminiKey: (geminiKey) => set({ geminiKey }),
      setAnthropicKey: (anthropicKey) => set({ anthropicKey }),
      setActiveModel: (activeModel) => set({ activeModel }),
      setCreativity: (creativity) => set({ creativity }),
      setGlobalPrompt: (globalPrompt) => set({ globalPrompt }),

      setLanguage: (language) => set({ language }),
      setAutosaveDelay: (autosaveDelay) => set({ autosaveDelay }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setStaleDays: (staleDays) => set({ staleDays }),
    }),
    {
      name: "cv-tailor-settings",
      // Le réglage est persisté : changer la valeur par défaut ne déplace pas ceux
      // qui ont déjà lancé l'app. Sans cette migration, `flash-lite` — et ses lettres
      // toutes identiques — resterait en place indéfiniment. Un choix délibéré pour
      // `flash-lite` est perdu ; il se refait en deux clics, là où l'inverse serait
      // invisible.
      version: 1,
      migrate: (state, version) => {
        const s = state as Partial<SettingsState>;
        if (version < 1 && s.activeModel === "gemini-3.1-flash-lite") {
          return { ...s, activeModel: "gemini-3.1-flash" } as SettingsState & SettingsActions;
        }
        return s as SettingsState & SettingsActions;
      },
    }
  )
);
