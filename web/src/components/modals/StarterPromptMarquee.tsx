"use client";

import { motion } from "framer-motion";

type StarterPromptMarqueeProps = {
  onSelect: (prompt: string) => void;
};

function promptPreview(prompt: string) {
  const words = prompt.split(/\s+/).filter(Boolean);
  return `${words.slice(0, 7).join(" ")}${words.length > 7 ? "…" : ""}`;
}

function chunkPrompts(prompts: string[], columns: number) {
  return prompts.reduce<string[][]>(
    (rows, prompt, index) => {
      if (!rows[index % columns]) {
        rows[index % columns] = [];
      }
      rows[index % columns].push(prompt);
      return rows;
    },
    Array.from({ length: columns }, () => [])
  );
}

export default function StarterPromptMarquee({ onSelect }: StarterPromptMarqueeProps) {
  const prompts = [
    "Améliore mon résumé professionnel pour le rendre plus impactant.",
    "Adapte ce CV pour un poste de chef de projet.",
    "Rend la section expérience plus orientée résultats.",
    "Traduis ce CV en anglais professionnel.",
    "Identifie les points faibles de mon CV et propose des améliorations.",
    "Raccourcis le CV pour qu'il tienne sur une seule page.",
    "Ajoute des mots-clés pertinents pour le marketing digital.",
    "Corrige l'orthographe et la grammaire de tout le document.",
    "Rédige une lettre de motivation à partir de ce CV.",
    "Adapte ce CV pour un poste orienté télétravail.",
    "Modifie les expériences pour valoriser la gestion d'équipe.",
    "Rends le ton du CV plus confiant et convaincant."
  ];

  const promptRows = chunkPrompts(prompts, 3);

  return (
    <div className="marquee-container">
      {promptRows.map((row, rowIndex) => {
        const marqueePrompts = row.flatMap((prompt) => [
          { id: `${prompt}-primary`, prompt },
          { id: `${prompt}-repeat-a`, prompt },
          { id: `${prompt}-repeat-b`, prompt },
        ]);
        const duration = 135 + rowIndex * 22;
        const animate = rowIndex % 2 === 0 ? { x: ["0%", "-33.333%"] } : { x: ["-33.333%", "0%"] };

        return (
          <motion.div
            key={`prompt-row-${rowIndex}`}
            className="marquee-row"
            animate={animate}
            transition={{ duration, ease: "linear", repeat: Infinity }}
          >
            {marqueePrompts.map(({ id, prompt }) => (
              <button
                key={id}
                type="button"
                className="marquee-btn"
                onClick={() => onSelect(prompt)}
                title={prompt}
              >
                {promptPreview(prompt)}
              </button>
            ))}
          </motion.div>
        );
      })}
    </div>
  );
}
