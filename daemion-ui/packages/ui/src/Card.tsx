import { type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./lib/cn";

const card = cva("rounded-lg border border-line", {
  variants: {
    surface: {
      base: "bg-surface",
      raised: "bg-surface-2 shadow-md",
    },
    pad: {
      none: "",
      sm: "p-3",
      md: "p-5",
      lg: "p-6",
    },
  },
  defaultVariants: { surface: "base", pad: "md" },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof card> {}

export function Card({ className, surface, pad, ...props }: CardProps) {
  return <div className={cn(card({ surface, pad }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3 flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-h3 text-text", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-small text-muted", className)} {...props} />;
}
