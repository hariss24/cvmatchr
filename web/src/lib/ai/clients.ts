import { GoogleGenAI, type Part, type Schema } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { useSettingsStore, type AiModel } from "@/state/settingsStore";

/**
 * Clients IA (Gemini + Anthropic) avec complétion streaming et non-streaming.
 */

// Legacy exports for backward compatibility (some components might use GEMINI_MODEL)
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const ANTHROPIC_MAX_TOKENS = 8192;

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export function isAnthropicKey(key: string): boolean {
  return key.startsWith("sk-ant-");
}

export function hasServerKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function serverKeyPreview(): string | null {
  const key = process.env.GEMINI_API_KEY || "";
  return key ? `${key.slice(0, 4)}…` : null;
}

export function requireActiveKey(overrideKey?: string | null): { key: string; provider: "gemini" | "anthropic"; model: AiModel } {
  const { activeModel, geminiKey, anthropicKey } = useSettingsStore.getState();
  
  if (overrideKey) {
    const provider = isAnthropicKey(overrideKey) ? "anthropic" : "gemini";
    let model = activeModel;
    if (provider === "anthropic" && !model.startsWith("claude-")) model = "claude-haiku-4-5-20251001";
    if (provider === "gemini" && !model.startsWith("gemini-")) model = "gemini-3.1-flash-lite";
    return { key: overrideKey, provider, model: model as AiModel };
  }

  const provider = activeModel.startsWith("claude-") ? "anthropic" : "gemini";

  if (provider === "anthropic") {
    if (!anthropicKey) {
      throw new Error("Clé Anthropic requise pour utiliser ce modèle. Ajoutez-la dans ⚙️ Paramètres.");
    }
    return { key: anthropicKey, provider, model: activeModel };
  } else {
    const key = geminiKey || process.env.GEMINI_API_KEY || "";
    if (!key) {
      throw new Error("Clé Gemini requise pour utiliser ce modèle. Ajoutez-la dans ⚙️ Paramètres.");
    }
    return { key, provider, model: activeModel };
  }
}

export function buildSystemPrompt(baseSystem: string): string {
  const { globalPrompt, language } = useSettingsStore.getState();
  let finalSystem = baseSystem;

  if (language === "en") {
    finalSystem += "\n\nCRITICAL: You must generate the output in English.";
  } else if (language === "fr") {
    finalSystem += "\n\nCRITICAL: You must generate the output in French.";
  }

  if (globalPrompt.trim()) {
    finalSystem += "\n\nUser Global Instructions (Must be followed strictly):\n" + globalPrompt.trim();
  }

  return finalSystem;
}

// ---- gestion du quota Gemini (port de _raise_for_gemini_quota) --------------

function parseRetryDelay(message: string): string | null {
  const m = message.match(/retryDelay['"]?\s*[:=]\s*['"]?(\d+)s/);
  if (!m) return null;
  const secs = Number(m[1]);
  return secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`;
}

/** Convertit une erreur de quota Gemini en message lisible ; sinon relance l'erreur d'origine. */
function rethrowGeminiError(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
    const delay = parseRetryDelay(message);
    const hint = delay ? ` Réessayez dans ${delay}.` : " Réessayez dans quelques minutes.";
    throw new Error(
      `Quota Gemini épuisé. ${hint} ` +
        "Pour ne plus avoir cette limite, configurez votre propre clé ou changez de modèle dans ⚙️ Paramètres.",
    );
  }
  throw err instanceof Error ? err : new Error(message);
}

// ---- streaming (port de stream_completion) ----------------------------------

/**
 * Appelle l'IA et émet les morceaux de réponse au fil de l'eau.
 *
 * @throws si aucune clé n'est disponible, ou si des images sont fournies avec une clé Anthropic.
 */
export async function* streamCompletion(
  prompt: string,
  system: string,
  opts: { images?: Uint8Array[]; apiKey?: string | null } = {},
): AsyncGenerator<string> {
  const { key, provider, model } = requireActiveKey(opts.apiKey);

  const images = opts.images ?? [];
  const finalSystem = buildSystemPrompt(system);
  const { creativity } = useSettingsStore.getState();

  if (provider === "anthropic") {
    if (images.length > 0) {
      throw new Error(
        "Le modèle Anthropic ne supporte pas la conversion PDF. Sélectionnez un modèle Gemini dans les Paramètres.",
      );
    }
    yield* streamAnthropic(prompt, finalSystem, key, model, creativity);
  } else {
    yield* streamGemini(prompt, finalSystem, images, key, model, creativity);
  }
}

async function* streamGemini(
  prompt: string,
  system: string,
  images: Uint8Array[],
  key: string,
  model: string,
  temperature: number,
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey: key });
  const parts: Part[] = images.map((img) => ({
    inlineData: { data: Buffer.from(img).toString("base64"), mimeType: "image/png" },
  }));
  parts.push({ text: prompt });

  try {
    const stream = await ai.models.generateContentStream({
      model,
      contents: [{ role: "user", parts }],
      config: { systemInstruction: system, temperature },
    });
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  } catch (err) {
    rethrowGeminiError(err);
  }
}

async function* streamAnthropic(
  prompt: string,
  system: string,
  key: string,
  model: string,
  temperature: number,
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: key });
  const stream = client.messages.stream({
    model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    temperature,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

// ---- non-streaming (port de _complete_gemini / _complete_anthropic) ----------

/** Complétion non-streaming à partir d'un historique de messages. Renvoie le texte complet. */
export async function complete(
  messages: ChatMessage[],
  system: string,
  apiKey?: string | null,
): Promise<string> {
  const { key, provider, model } = requireActiveKey(apiKey);

  const finalSystem = buildSystemPrompt(system);
  const { creativity } = useSettingsStore.getState();

  return provider === "anthropic"
    ? completeAnthropic(messages, finalSystem, key, model, creativity)
    : completeGemini(messages, finalSystem, key, model, creativity);
}

async function completeGemini(
  messages: ChatMessage[],
  system: string,
  key: string,
  model: string,
  temperature: number,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: key });
  const contents = messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { systemInstruction: system, temperature },
    });
    return response.text ?? "";
  } catch (err) {
    rethrowGeminiError(err);
  }
}

/**
 * Complétion Gemini à sortie JSON structurée (response schema).
 */
export async function completeJson(
  prompt: string,
  system: string,
  schema: Schema,
  apiKey?: string | null,
): Promise<string> {
  const { key, provider, model } = requireActiveKey(apiKey);

  if (provider === "anthropic") {
    throw new Error("La fonctionnalité nécessite un modèle Gemini. Modifiez le modèle actif dans ⚙️ Paramètres.");
  }
  const ai = new GoogleGenAI({ apiKey: key });
  const finalSystem = buildSystemPrompt(system);
  const { creativity } = useSettingsStore.getState();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: finalSystem,
        temperature: creativity,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    return response.text ?? "";
  } catch (err) {
    rethrowGeminiError(err);
  }
}

async function completeAnthropic(
  messages: ChatMessage[],
  system: string,
  key: string,
  model: string,
  temperature: number,
): Promise<string> {
  const client = new Anthropic({ apiKey: key });
  const response = await client.messages.create({
    model,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    temperature,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const block = response.content[0];
  return block && block.type === "text" ? block.text : "";
}
