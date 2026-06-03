"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const WORDS = [
  { fr: "l'intelligence", en: "intelligence", g: "from-primary-300 to-primary-500" },
  { fr: "le marketing", en: "marketing", g: "from-primary-400 to-[#60a5fa]" },
  { fr: "la vidéo", en: "video", g: "from-[#a78bfa] to-[#7c3aed]" },
  { fr: "la connectivité", en: "connectivity", g: "from-success-500 to-[#34d399]" },
  { fr: "la puissance", en: "power", g: "from-warning-500 to-[#f59e0b]" },
];

/** Mot qui change en boucle dans le hero, avec dégradé par thème. */
export function RotatingWord() {
  const [i, setI] = useState(0);
  const t = useT();

  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % WORDS.length), 2200);
    return () => clearInterval(id);
  }, []);

  const w = WORDS[i];
  return (
    <span className="relative inline-block">
      <span
        key={i}
        className={`inline-block animate-[swap_500ms_ease-out] bg-gradient-to-r ${w.g} bg-clip-text text-transparent`}
      >
        {t(w.fr, w.en)}
      </span>
    </span>
  );
}
