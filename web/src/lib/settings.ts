import { uiPrompt, toast } from "@/state/uiStore";

const STORAGE_KEY_APIKEY = "userApiKey";

/** Invite l'utilisateur à coller (ou effacer) sa clé API IA (Gemini ou Anthropic). */
export async function promptApiKey(): Promise<void> {
  if (typeof window === "undefined") return;
  const current = localStorage.getItem(STORAGE_KEY_APIKEY) || "";
  const v = await uiPrompt(
    "Collez votre clé API (Gemini ou Anthropic). Laissez vide pour utiliser la clé serveur.",
    current,
    "Paramètres API",
  );
  if (v === null) return;
  if (v.trim()) {
    localStorage.setItem(STORAGE_KEY_APIKEY, v.trim());
    toast("Clé API enregistrée.", "success");
  } else {
    localStorage.removeItem(STORAGE_KEY_APIKEY);
    toast("Clé API effacée (clé serveur utilisée).", "success");
  }
}
