"use client";

import { useEffect, useState } from "react";
import { SEARCH_PLACEHOLDERS } from "@/lib/search/placeholders";

export function useRotatingSearchPlaceholder(paused: boolean, phrases: readonly string[] = SEARCH_PLACEHOLDERS) {
  const [text, setText] = useState(phrases[0] ?? "");

  useEffect(() => {
    if (paused || !phrases.length) return undefined;
    let phraseIndex = 0;
    let charIndex = 0;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const phrase = phrases[phraseIndex % phrases.length];
      if (charIndex <= phrase.length) {
        setText(phrase.slice(0, Math.max(1, charIndex)));
        charIndex += 1;
        timer = setTimeout(tick, 42);
        return;
      }
      timer = setTimeout(() => {
        phraseIndex += 1;
        charIndex = 0;
        tick();
      }, 1600);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [paused, phrases]);

  return paused ? "" : text;
}
