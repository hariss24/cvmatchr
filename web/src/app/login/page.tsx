"use client";

import { useState } from "react";
import { toast } from "@/state/uiStore";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        toast("Authentification réussie.", "success");
        // Force le rechargement pour relancer l'application avec l'état connecté
        window.location.href = "/";
      } else {
        const data = await res.json();
        toast(data.error || "Échec de l'authentification.", "error");
      }
    } catch {
      toast("Erreur réseau.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: "100vh", 
      backgroundColor: "var(--bg-primary)"
    }}>
      <form onSubmit={handleLogin} style={{
        backgroundColor: "var(--bg-secondary)",
        padding: "30px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        width: "100%",
        maxWidth: "400px",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", color: "var(--text-primary)" }}>Accès restreint</h1>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Cette instance est protégée par mot de passe.
        </p>
        
        <input
          className="form-input"
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
          autoFocus
        />
        
        <button type="submit" className="go" disabled={loading || !password}>
          {loading ? "Vérification..." : "Déverrouiller"}
        </button>
      </form>
    </div>
  );
}
