"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, variant = "primary", size, name, value, confirm }: {
  children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm"; name?: string; value?: string; confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`btn-${variant} ${size === "sm" ? "btn-sm" : ""}`}
    >
      {pending ? "…" : children}
    </button>
  );
}
