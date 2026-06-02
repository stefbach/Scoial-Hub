"use client";

import { useEffect, useState } from "react";

const WORDS = [
  { t: "l'intelligence", g: "from-primary-300 to-primary-500" },
  { t: "le marketing", g: "from-primary-400 to-[#60a5fa]" },
  { t: "la vidéo", g: "from-[#a78bfa] to-[#7c3aed]" },
  { t: "la connectivité", g: "from-success-500 to-[#34d399]" },
  { t: "la puissance", g: "from-warning-500 to-[#f59e0b]" },
];

/** Mot qui change en boucle dans le hero, avec dégradé par thème. */
export function RotatingWord() {
  const [i, setI] = useState(0);
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
        {w.t}
      </span>
    </span>
  );
}
