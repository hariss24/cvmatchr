import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AiProvider = "gemini" | "anthropic";
export type AiModel = 
  | "gemini-3.1-flash-lite" // Default for Gemini
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
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      geminiKey: "",
      anthropicKey: "",
      activeModel: "gemini-3.1-flash-lite", // Default model
      creativity: 0.7,
      globalPrompt: "",

      language: "fr",
      autosaveDelay: 1000,
      accentColor: "orange",

      setGeminiKey: (geminiKey) => set({ geminiKey }),
      setAnthropicKey: (anthropicKey) => set({ anthropicKey }),
      setActiveModel: (activeModel) => set({ activeModel }),
      setCreativity: (creativity) => set({ creativity }),
      setGlobalPrompt: (globalPrompt) => set({ globalPrompt }),

      setLanguage: (language) => set({ language }),
      setAutosaveDelay: (autosaveDelay) => set({ autosaveDelay }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    {
      name: "cv-tailor-settings",
    }
  )
);
