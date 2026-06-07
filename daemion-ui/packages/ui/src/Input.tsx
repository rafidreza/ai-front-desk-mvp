import { forwardRef, type InputHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const input = cva(
  [
    "w-full rounded-md bg-surface-2 text-text",
    "border border-line px-3 text-small",
    "placeholder:text-faint",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:border-accent-border focus-visible:ring-2 focus-visible:ring-accent/40",
    // disabled inputs use the same explicit disabled tokens (audit R3)
    "disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-fg disabled:border-disabled-border",
  ],
  {
    variants: {
      size: { sm: "h-8", md: "h-10", lg: "h-12" },
      invalid: { true: "border-danger focus-visible:border-danger focus-visible:ring-danger/40" },
    },
    defaultVariants: { size: "md" },
  }
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof input> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(input({ size, invalid }), className)} {...props} />
  )
);
Input.displayName = "Input";
