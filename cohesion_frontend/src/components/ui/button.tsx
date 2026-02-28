"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "destructive";
    size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
        const baseStyles =
            "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[oklch(0.12_0_0)] disabled:opacity-50 disabled:pointer-events-none rounded-lg";

        const variants = {
            primary:
                "border-2 border-white bg-transparent text-white hover:bg-white hover:text-black",
            secondary:
                "border border-white/20 bg-transparent text-white/80 hover:border-white/40 hover:text-white",
            ghost:
                "bg-transparent text-white/60 hover:text-white hover:bg-white/5",
            destructive:
                "border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-black",
        };

        const sizes = {
            sm: "h-8 px-3 text-sm gap-1.5",
            md: "h-9 px-4 text-sm gap-2",
            lg: "h-10 px-5 text-sm gap-2",
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";
