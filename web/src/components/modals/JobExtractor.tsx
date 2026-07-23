import { useState } from "react";
import { toast } from "@/state/uiStore";

interface JobExtractorProps {
  onExtracted: (text: string) => void;
  disabled?: boolean;
}

export default function JobExtractor({ onExtracted, disabled }: JobExtractorProps) {
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);

  const extractUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast("Colle une URL d'offre d'emploi.", "error");
      return;
    }

    setExtracting(true);
    try {
      const res = await fetch("/api/extract-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast(data.error || "Erreur lors de l'extraction.", "error");
        return;
      }

      onExtracted(data.text);
      setUrl("");
      
      if (data.title) {
        toast(`Extrait : ${data.title.substring(0, 60)}`, "success");
      } else {
        toast(`Extrait : ${data.text.length} caractères`, "success");
      }
    } catch {
      toast("Erreur réseau lors de l'extraction.", "error");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="job-extractor-row">
      <input
        className="form-input"
        type="url"
        placeholder="URL de l'offre (LinkedIn, Welcome to the Jungle...)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={disabled || extracting}
      />
      <button
        type="button"
        className="form-btn-mini"
        onClick={extractUrl}
        disabled={disabled || extracting || !url.trim()}
      >
        {extracting ? "Extraction..." : "Extraire"}
      </button>
    </div>
  );
}
