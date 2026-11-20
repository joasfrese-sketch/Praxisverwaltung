"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { SendHorizontal } from "lucide-react";
import { sendChatMessage, type ChatState } from "@/app/actions/chat";

export function ScrollToEnd({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [count]);
  return <div ref={ref} className="flex-1 overflow-y-auto px-3 py-2">{children}</div>;
}

export function ChatComposer({ to, placeholder }: { to: string; placeholder: string }) {
  const [state, action, pending] = useActionState<ChatState, FormData>(sendChatMessage, null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (state?.sentAt) {
      form.current?.reset();
      input.current?.focus();
    }
  }, [state?.sentAt]);
  return (
    <form ref={form} action={action} className="border-t border-slate-100 p-2">
      <input type="hidden" name="to" value={to} />
      {state?.error && <p className="mb-1 text-sm text-rose-700">{state.error}</p>}
      <div className="flex items-end gap-2">
        <textarea ref={input} name="body" rows={1} required maxLength={4000} placeholder={placeholder} aria-label="Nachricht"
          className="input max-h-40 min-h-10 flex-1 resize-y"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              form.current?.requestSubmit();
            }
          }} />
        <button className="btn-primary h-10" disabled={pending} aria-label="Senden"><SendHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Senden</span></button>
      </div>
      <p className="mt-1 hidden text-xs text-slate-500 sm:block">Enter sendet, Umschalt+Enter für neue Zeile.</p>
    </form>
  );
}
