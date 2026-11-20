"use client";
import { useEffect } from "react";

/** Übernimmt die im Konto gespeicherte Schriftgröße auf ein neues Gerät (Cookie fehlt dort noch). */
export function FontSync({ scale }: { scale: number }) {
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )schrift=(\d+)/);
    if (Number(m?.[1] ?? 100) === scale) return;
    document.cookie = `schrift=${scale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.style.fontSize = scale === 100 ? "" : `${scale}%`;
  }, [scale]);
  return null;
}
