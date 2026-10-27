import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { useUiV2 } from "@/lib/uiV2";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// V2 (vidro): a situação vira texto com bolinha, no lugar da pílula. O contorno
// (outline) continua pílula, para contagens e etiquetas neutras.
const badgeVariantsV2 = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-transparent px-0 text-foreground before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        secondary: "border-transparent bg-transparent px-0 text-muted-foreground before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        destructive: "border-transparent bg-transparent px-0 text-destructive before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  const v2 = useUiV2();
  if (!v2) return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
  // Quem passa uma cor de fundo própria continua com a pílula, sem a bolinha.
  const temFundo = /(^|\s)(dark:)?bg-/.test(className ?? "");
  return <div className={cn(badgeVariantsV2({ variant: temFundo && variant !== "outline" ? "outline" : variant }), temFundo && "border-transparent", className)} {...props} />;
}

export { Badge, badgeVariants };
