import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const pill = cva(
  "inline-flex items-center gap-1.5 rounded-pill font-mono text-micro uppercase tracking-[0.08em] px-2.5 py-1 border",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-muted border-line",
        accent: "bg-accent-soft text-accent border-accent-border",
        success: "bg-success/12 text-success border-accent-border",
        warn: "bg-warn/13 text-warn border-warn/30",
        danger: "bg-danger/13 text-danger border-danger/30",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface PillProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pill> {
  /** show a leading status dot */
  dot?: boolean;
}

export function Pill({ className, tone, dot, children, ...props }: PillProps) {
  return (
    <span className={cn(pill({ tone }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-pill bg-current" />}
      {children}
    </span>
  );
}
