"use client";

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { MatchStatus } from "@/lib/types";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "method" | "status" | "source";
    status?: MatchStatus;
    method?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = "default", status, method, children, ...props }, ref) => {
        const baseStyles =
            "inline-flex items-center justify-center px-2 py-0.5 text-xs font-mono rounded border";

        const getMethodStyles = (m: string) => {
            const methods: Record<string, string> = {
                GET: "border-green-600/50 text-green-500 bg-green-950/30",
                POST: "border-blue-600/50 text-blue-400 bg-blue-950/30",
                PUT: "border-amber-600/50 text-amber-400 bg-amber-950/30",
                PATCH: "border-orange-600/50 text-orange-400 bg-orange-950/30",
                DELETE: "border-red-600/50 text-red-400 bg-red-950/30",
            };
            return methods[m.toUpperCase()] || "border-white/20 text-white/60";
        };

        const getStatusStyles = (s: MatchStatus) => {
            const statuses: Record<MatchStatus, string> = {
                match: "border-green-600/50 text-green-500",
                partial: "border-amber-600/50 text-amber-400",
                violation: "border-red-600/50 text-red-400",
            };
            return statuses[s];
        };

        const variants = {
            default: "border-white/20 text-white/60",
            method: method ? getMethodStyles(method) : "",
            status: status ? getStatusStyles(status) : "",
            source: "border-white/20 text-white/60",
        };

        return (
            <span
                ref={ref}
                className={cn(baseStyles, variants[variant], className)}
                {...props}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = "Badge";
