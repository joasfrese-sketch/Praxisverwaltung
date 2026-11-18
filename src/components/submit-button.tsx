"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, variant = "primary", size, name, value, confirm, className }: {
  children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; size?: "sm"; name?: string; value?: string; confirm?: string; className?: string;
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
      className={className ? `btn ${size === "sm" ? "btn-sm" : ""} ${className}` : `btn-${variant} ${size === "sm" ? "btn-sm" : ""}`}
    >
      {pending ? "…" : children}
    </button>
  );
}
