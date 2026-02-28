"use client";

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { MatchStatus } from "@/lib/types";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    status?: MatchStatus;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, children, status, ...props }, ref) => {
        const statusStyles = {
            match: "border-[oklch(0.72_0.19_145_/_20%)] hover:border-[oklch(0.72_0.19_145_/_30%)]",
            partial: "border-[oklch(0.78_0.16_75_/_25%)] hover:border-[oklch(0.78_0.16_75_/_40%)]",
            violation: "card-violation border-[oklch(0.65_0.24_25_/_30%)] hover:border-[oklch(0.65_0.24_25_/_50%)]",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "bg-[var(--surface)] border border-[var(--border)] rounded-lg transition-all duration-200",
                    status && statusStyles[status],
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = "Card";

export const CardHeader = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("px-4 pt-4 pb-2", className)}
        {...props}
    />
));

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
    HTMLHeadingElement,
    HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn("text-sm font-semibold text-white", className)}
        {...props}
    />
));

CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
    HTMLParagraphElement,
    HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-xs text-white/50 mt-0.5", className)}
        {...props}
    />
));

CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-4 pb-4", className)} {...props} />
));

CardContent.displayName = "CardContent";

interface TensionBarProps {
    status: MatchStatus;
    percentage?: number;
}

export function TensionBar({ status, percentage = 100 }: TensionBarProps) {
    const statusClass = {
        match: "tension-bar-fill-match",
        partial: "tension-bar-fill-partial",
        violation: "tension-bar-fill-violation",
    }[status];

    return (
        <div className="tension-bar">
            <div
                className={cn("tension-bar-fill", statusClass)}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}
