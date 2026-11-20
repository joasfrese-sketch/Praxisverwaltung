"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Lädt die Seite neu, sobald sich Termine/Benachrichtigungen/Abwesenheiten/Chat der Praxis ändern. */
export function RealtimeRefresh({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    const filter = `practice_id=eq.${practiceId}`;
    const ch = supabase
      .channel(`praxis-${practiceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_absences", filter }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter }, refresh)
      .subscribe();
    const interval = setInterval(() => router.refresh(), 60_000); // Verzögerungen laufend neu bewerten
    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, [practiceId, router]);
  return null;
}
