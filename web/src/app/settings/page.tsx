"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/storage/db";
import { exportDatabase, importDatabase, resetDatabase } from "@/lib/storage/backup";
import SegmentedNav from "@/components/layout/SegmentedNav";
import { useSettingsStore, type AiModel, type AccentColor } from "@/state/settingsStore";
import CustomSelect from "@/components/ui/CustomSelect";

export default function SettingsPage() {
  const [theme, setTheme] = useState("light");
  const [stats, setStats] = useState({
    history: 0,
    jobs: 0,
    snapshots: 0,
    templates: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const settings = useSettingsStore();

  useEffect(() => {
    const oldKey = localStorage.getItem("userApiKey");
    if (oldKey && !settings.geminiKey) {
      settings.setGeminiKey(oldKey.trim());
      localStorage.removeItem("userApiKey");
    }

    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const id = setTimeout(() => setTheme(currentTheme), 0);

    const loadStats = async () => {
      try {
        const historyCount = await db.history.count();
        const jobsCount = await db.jobs.count();
        const snapshotsCount = await db.snapshots.count();
        const templatesCount = await db.templates.count();
        setStats({
          history: historyCount,
          jobs: jobsCount,
          snapshots: snapshotsCount,
          templates: templatesCount,
        });
      } catch (e) {
        console.error("Failed to load DB stats", e);
      }
    };
    void loadStats();
    
    return () => clearTimeout(id);
  }, [settings]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const jsonString = event.target?.result as string;
      await importDatabase(jsonString);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const isAnthropicRequired = settings.activeModel.startsWith("claude-");

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Paramètres & Dashboard</h1>
        <div className="topbar-center mobile-hidden">
          <SegmentedNav />
        </div>
        <div className="topbar-actions">
          <Link href="/" className="btn-nav">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Retour
          </Link>
        </div>
      </header>

      <div className="pane" style={{ overflowY: "auto" }}>
        <div className="pane-body form-editor" style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
          
          {/* DASHBOARD SECTION */}
          <section className="form-section">
            <h3 className="form-section__title">Dashboard</h3>
            <div className="form-grid">
              <div className="form-item" style={{ padding: "16px", margin: 0 }}>
                <div className="form-label" style={{ marginBottom: "8px" }}>Documents générés</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text)" }}>{stats.history}</div>
              </div>
              <div className="form-item" style={{ padding: "16px", margin: 0 }}>
                <div className="form-label" style={{ marginBottom: "8px" }}>Offres suivies</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text)" }}>{stats.jobs}</div>
              </div>
              <div className="form-item" style={{ padding: "16px", margin: 0 }}>
                <div className="form-label" style={{ marginBottom: "8px" }}>Snapshots d&apos;historique</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text)" }}>{stats.snapshots}</div>
              </div>
              <div className="form-item" style={{ padding: "16px", margin: 0 }}>
                <div className="form-label" style={{ marginBottom: "8px" }}>Modèles personnalisés</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text)" }}>{stats.templates}</div>
              </div>
            </div>
          </section>

          {/* AI CONFIGURATION */}
          <section className="form-section">
            <h3 className="form-section__title">Configuration IA</h3>
            
            <div className="form-section__body">
              {/* Choix du modèle */}
              <div className="form-field">
                <label className="form-label">Modèle Actif</label>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", lineHeight: "1.5" }}>
                  Sélectionnez l&apos;intelligence artificielle que vous souhaitez utiliser pour la génération. Les modèles Claude nécessitent d&apos;ajouter votre propre clé Anthropic.
                </p>
                <CustomSelect<AiModel>
                  value={settings.activeModel} 
                  onChange={(v) => settings.setActiveModel(v)}
                  style={{ width: "100%" }}
                  options={[
                    { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash (Rapide & Par défaut)", group: "Modèles Google (Gemini)" },
                    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Puissant)", group: "Modèles Google (Gemini)" },
                    { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet (Très intelligent)", group: "Modèles Anthropic (Claude)" },
                    { value: "claude-haiku-4-5-20251001", label: "Claude 3.5 Haiku (Ultra rapide)", group: "Modèles Anthropic (Claude)" },
                  ]}
                />
              </div>

              {/* Clés API */}
              <div className="form-grid">
                <div className="form-field">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    Clé API Gemini
                    {!isAnthropicRequired && <span style={{ fontSize: "10px", background: "var(--success)", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>REQUISE</span>}
                  </label>
                  <input
                    type="password"
                    value={settings.geminiKey}
                    onChange={(e) => settings.setGeminiKey(e.target.value)}
                    placeholder="Laissez vide pour utiliser celle du serveur"
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    Clé API Anthropic
                    {isAnthropicRequired && <span style={{ fontSize: "10px", background: "var(--success)", color: "#fff", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>REQUISE</span>}
                  </label>
                  <input
                    type="password"
                    value={settings.anthropicKey}
                    onChange={(e) => settings.setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="form-input"
                  />
                </div>
              </div>

              {/* Créativité */}
              <div className="form-field">
                <label className="form-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Niveau de Créativité</span>
                  <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "normal", background: "var(--bg)", padding: "2px 8px", borderRadius: "12px", boxShadow: "var(--neu-inset)" }}>
                    {settings.creativity < 0.3 ? "Strict et Factuel" : settings.creativity > 0.7 ? "Très Créatif" : "Équilibré"} 
                    {" (" + Math.round(settings.creativity * 100) + "%)"}
                  </span>
                </label>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", lineHeight: "1.5" }}>
                  Ajustez si vous souhaitez que l&apos;IA soit stricte et factuelle (0%) ou plus originale dans ses tournures (100%).
                </p>
                <input
                  type="range"
                  min="0" max="1" step="0.1"
                  value={settings.creativity}
                  onChange={(e) => settings.setCreativity(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--orange)", cursor: "pointer" }}
                />
              </div>

              {/* Instructions Globales */}
              <div className="form-field">
                <label className="form-label">Instructions Globales (Optionnel)</label>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", lineHeight: "1.5" }}>
                  Donnez une consigne permanente à l&apos;IA pour toutes vos générations (ex: &quot;Je suis un développeur senior très direct, utilise un ton formel&quot;).
                </p>
                <textarea
                  className="form-textarea"
                  value={settings.globalPrompt}
                  onChange={(e) => settings.setGlobalPrompt(e.target.value)}
                  placeholder="Consignes additionnelles appliquées à chaque requête..."
                  rows={3}
                />
              </div>

            </div>
          </section>

          {/* PREFERENCES APP */}
          <section className="form-section">
            <h3 className="form-section__title">Préférences de l&apos;Application</h3>
            
            <div className="form-section__body">
              
              {/* Langue par défaut */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div className="form-field">
                  <div className="form-label">Langue de génération</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Langue dans laquelle l&apos;IA rédigera le contenu.</div>
                </div>
                <CustomSelect<string>
                  value={settings.language} 
                  onChange={(v) => settings.setLanguage(v)}
                  style={{ width: "220px", flexShrink: 0 }}
                  options={[
                    { value: "fr", label: "Français" },
                    { value: "en", label: "Anglais" },
                    { value: "es", label: "Espagnol" },
                    { value: "zh", label: "Chinois (Mandarin)" },
                    { value: "hi", label: "Hindi" },
                    { value: "ar", label: "Arabe" },
                  ]}
                />
              </div>

              <div style={{ height: "1px", background: "var(--border)" }} />

              {/* Sauvegarde auto */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div className="form-field">
                  <div className="form-label">Sauvegarde Automatique</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Fréquence d&apos;enregistrement de vos brouillons.</div>
                </div>
                <CustomSelect<number>
                  value={settings.autosaveDelay} 
                  onChange={(v) => settings.setAutosaveDelay(v)}
                  style={{ width: "220px", flexShrink: 0 }}
                  options={[
                    { value: 1000, label: "Rapide (1 seconde)" },
                    { value: 5000, label: "Normal (5 secondes)" },
                    { value: 30000, label: "Lent (30 secondes)" },
                    { value: 0, label: "Manuel (Désactivé)" },
                  ]}
                />
              </div>

              <div style={{ height: "1px", background: "var(--border)" }} />

              {/* Thème */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div className="form-field">
                  <div className="form-label">Mode Sombre / Clair</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Changer le contraste général de l&apos;interface.</div>
                </div>
                <button type="button" className="btn-nav" onClick={toggleTheme}>
                  {theme === "dark" ? (
                    <>
                      <svg className="theme-ico theme-ico--moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                      Mode sombre
                    </>
                  ) : (
                    <>
                      <svg className="theme-ico theme-ico--sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
                      Mode clair
                    </>
                  )}
                </button>
              </div>

              <div style={{ height: "1px", background: "var(--border)" }} />

              {/* Couleur d'accentuation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div className="form-field">
                  <div className="form-label">Couleur Principale</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)" }}>Personnalisez la couleur des boutons et icônes.</div>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {(["orange", "blue", "green", "purple"] as AccentColor[]).map((color) => {
                    const colorMap: Record<string, string> = {
                      orange: "#E85D04",
                      blue: "#1565C0",
                      green: "#256D2A",
                      purple: "#6A1B9A"
                    };
                    const isActive = settings.accentColor === color;
                    return (
                      <button 
                        key={color}
                        type="button"
                        onClick={() => settings.setAccentColor(color)}
                        style={{
                          width: "28px", height: "28px", borderRadius: "50%",
                          background: colorMap[color],
                          border: isActive ? "3px solid var(--field)" : "none",
                          boxShadow: isActive ? "0 0 0 2px var(--text)" : "var(--neu-raised-sm)",
                          cursor: "pointer", transition: "transform 100ms"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.15)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                        aria-label={`Couleur ${color}`}
                        title={color}
                      />
                    );
                  })}
                </div>
              </div>

            </div>
          </section>

          {/* DATA MANAGEMENT */}
          <section className="form-section" style={{ paddingBottom: "40px" }}>
            <h3 className="form-section__title">Gestion des données</h3>
            <div className="form-section__body" style={{ gap: "0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", paddingBottom: "12px" }}>
                <div className="form-field">
                  <div className="form-label">Exporter les données</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "400px" }}>Télécharger toutes vos données (historique, offres, profil, etc.) dans un fichier JSON.</div>
                </div>
                <button type="button" className="btn-nav" onClick={exportDatabase}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Exporter
                </button>
              </div>
              
              <div style={{ height: "1px", background: "var(--border)" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "12px 0" }}>
                <div className="form-field">
                  <div className="form-label">Importer des données</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "400px" }}>Restaurer des données à partir d&apos;un fichier d&apos;export. <strong>Attention :</strong> Cela remplacera les données actuelles.</div>
                </div>
                <input
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <button type="button" className="btn-nav" onClick={handleImportClick}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  Importer
                </button>
              </div>

              <div style={{ height: "1px", background: "var(--border)" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", paddingTop: "12px" }}>
                <div className="form-field">
                  <div className="form-label" style={{ color: "var(--error)" }}>Réinitialiser l&apos;application</div>
                  <div style={{ fontSize: "13px", color: "var(--muted)", maxWidth: "400px" }}>Supprimer définitivement toutes les données locales de l&apos;application.</div>
                </div>
                <button type="button" className="btn-nav" onClick={resetDatabase} style={{ color: "var(--error)", borderColor: "rgba(198, 40, 40, 0.3)" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Réinitialiser
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
