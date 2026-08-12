"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useAuthStore } from "@/state/authStore";
import { toast } from "@/state/uiStore";

/** Sous-ensemble de l'API Google Identity Services réellement utilisé ici. */
type GsiCredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: GsiCredentialResponse) => void;
            nonce?: string;
            use_fedcm_for_prompt?: boolean;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
              locale?: string;
            },
          ): void;
        };
      };
    };
  }
}

/**
 * Génère le couple de nonces attendu par le flux : Google reçoit la version
 * hachée (SHA-256), Supabase la version brute.
 */
async function generateNonce(): Promise<[string, string]> {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const encodedNonce = new TextEncoder().encode(nonce);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedNonce);
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [nonce, hashedNonce];
}

/**
 * Bouton « Se connecter avec Google » rendu par Google Identity Services.
 *
 * On rend le bouton officiel plutôt que d'appeler `prompt()` (One Tap) : après
 * un refus, Google met le prompt en sommeil pendant plusieurs jours et l'appel
 * échoue silencieusement — le bouton paraîtrait cassé.
 *
 * Ne rend rien si `NEXT_PUBLIC_GOOGLE_CLIENT_ID` est absent : l'appelant se
 * rabat alors sur le flux de redirection classique.
 */
export default function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const signInWithGoogleIdToken = useAuthStore((s) => s.signInWithGoogleIdToken);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const render = useCallback(async () => {
    if (!clientId || !containerRef.current || !window.google) return;

    const [nonce, hashedNonce] = await generateNonce();

    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        void signInWithGoogleIdToken(response.credential, nonce).catch(() => {
          toast("La connexion a échoué. Réessayez.", "error");
        });
      },
    });

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: isDark ? "filled_black" : "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
      width: 220,
      locale: "fr",
    });
  }, [clientId, signInWithGoogleIdToken]);

  useEffect(() => {
    if (scriptReady) void render();
  }, [scriptReady, render]);

  if (!clientId) return null;

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} style={{ display: "flex", justifyContent: "center", padding: "8px 12px" }} />
    </>
  );
}
