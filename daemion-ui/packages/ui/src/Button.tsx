import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const button = cva(
  // base
  [
    "inline-flex items-center justify-center gap-2 select-none",
    "font-body font-medium whitespace-nowrap",
    "rounded-md transition-colors duration-150",
    "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    // DISABLED — explicit non-interactive surface, NOT opacity-dimmed accent.
    // Fixes audit R1: disabled login button is now obviously off + legible.
    "disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-fg",
    "disabled:border-disabled-border disabled:shadow-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-bg hover:bg-accent-hover active:bg-accent-pressed",
        secondary:
          "bg-surface-2 text-text border border-line hover:border-line-strong",
        ghost:
          "bg-transparent text-muted hover:text-text hover:bg-surface-2",
        danger:
          "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
      },
      size: {
        sm: "h-8 px-3 text-tiny",
        md: "h-10 px-4 text-small",
        lg: "h-12 px-6 text-body",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size, block }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
