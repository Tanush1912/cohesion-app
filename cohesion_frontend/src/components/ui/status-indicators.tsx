"use client";

import { cn } from "@/lib/utils";
import { MatchStatus } from "@/lib/types";

interface StatusOrbProps {
    status: MatchStatus;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function StatusOrb({ status, size = "md", className }: StatusOrbProps) {
    const sizeClasses = {
        sm: "w-2 h-2",
        md: "w-3 h-3",
        lg: "w-4 h-4",
    };

    const statusClasses = {
        match: "bg-[var(--success)] animate-pulse-success",
        partial: "bg-[var(--warning)] animate-pulse-warning",
        violation: "bg-[var(--error)] animate-pulse-error",
    };

    return (
        <span
            className={cn(
                "rounded-full inline-block",
                sizeClasses[size],
                statusClasses[status],
                className
            )}
            aria-label={`Status: ${status}`}
        />
    );
}

interface SourceBadgeProps {
    source: "backend" | "frontend" | "runtime";
    active?: boolean;
    className?: string;
}

export function SourceBadge({ source, active = true, className }: SourceBadgeProps) {
    const labels = {
        backend: "BE",
        frontend: "FE",
        runtime: "RT",
    };

    const activeClasses = {
        backend: "text-[var(--backend)] border-[var(--backend)]",
        frontend: "text-[var(--frontend)] border-[var(--frontend)]",
        runtime: "text-[var(--runtime)] border-[var(--runtime)]",
    };

    return (
        <span
            className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                active ? activeClasses[source] : "text-white/20 border-white/10",
                className
            )}
        >
            {labels[source]}
        </span>
    );
}

interface ContractHealthProps {
    matchCount: number;
    partialCount: number;
    violationCount: number;
    className?: string;
}

export function ContractHealth({
    matchCount,
    partialCount,
    violationCount,
    className
}: ContractHealthProps) {
    const total = matchCount + partialCount + violationCount;
    if (total === 0) return null;

    const matchPct = (matchCount / total) * 100;
    const partialPct = (partialCount / total) * 100;
    const violationPct = (violationCount / total) * 100;

    return (
        <div className={cn("w-full", className)}>
            <div className="flex h-2 rounded-full overflow-hidden bg-[var(--border)]">
                {matchPct > 0 && (
                    <div
                        className="bg-[var(--success)] transition-all duration-500"
                        style={{ width: `${matchPct}%` }}
                    />
                )}
                {partialPct > 0 && (
                    <div
                        className="bg-[var(--warning)] transition-all duration-500"
                        style={{ width: `${partialPct}%` }}
                    />
                )}
                {violationPct > 0 && (
                    <div
                        className="bg-[var(--error)] transition-all duration-500"
                        style={{ width: `${violationPct}%` }}
                    />
                )}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-white/40 font-mono">
                <span>{matchCount} matched</span>
                {partialCount > 0 && <span>{partialCount} partial</span>}
                {violationCount > 0 && <span className="text-[var(--error)]">{violationCount} violations</span>}
            </div>
        </div>
    );
}
