import { type ReactNode } from "react";
import { cn } from "./lib/cn";

export interface FieldProps {
  /** ALL-CAPS label. Rendered in --text-faint, which clears AA (fixes audit R2). */
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Form field wrapper: legible label + hint/error slots.
 *  Replaces the tiny low-contrast ALL-CAPS labels flagged in the audit. */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="font-mono text-micro uppercase tracking-[0.08em] text-faint"
      >
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-tiny text-danger">{error}</p>
      ) : hint ? (
        <p className="text-tiny text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
