"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusOrb, SourceBadge } from "@/components/ui/status-indicators";
import { Endpoint, MatchStatus, SchemaSource } from "@/lib/types";
import { cn } from "@/lib/utils";

interface EndpointFlowRowProps {
    endpoint: Endpoint;
    projectId: string;
    index: number;
    status?: MatchStatus;
    mismatchCount?: number;
}

export function EndpointFlowRow({
    endpoint,
    projectId,
    index,
    status = "match",
    mismatchCount = 0,
}: EndpointFlowRowProps) {
    const sources = endpoint.schemas?.map((s) => s.source) || [];
    const hasBackend = sources.includes("backend-static" as SchemaSource);
    const hasFrontend = sources.includes("frontend-static" as SchemaSource);
    const hasRuntime = sources.includes("runtime-observed" as SchemaSource);

    const methodColors: Record<string, string> = {
        GET: "bg-green-500/10 text-green-400 border-green-500/30",
        POST: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        PUT: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        PATCH: "bg-orange-500/10 text-orange-400 border-orange-500/30",
        DELETE: "bg-red-500/10 text-red-400 border-red-500/30",
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02, duration: 0.15 }}
        >
            <Link href={`/projects/${projectId}/endpoints/${endpoint.id}`}>
                <div className={cn(
                    "group relative rounded-lg border transition-all duration-200 overflow-hidden",
                    "hover:bg-[var(--surface-elevated)] cursor-pointer",
                    status === "violation" && "border-[oklch(0.65_0.24_25_/_20%)] card-violation",
                    status === "partial" && "border-[oklch(0.78_0.16_75_/_20%)]",
                    status === "match" && "border-[var(--border)] hover:border-[var(--border-strong)]"
                )}>
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                        {/* Method badge */}
                        <span className={cn(
                            "px-2 py-1 text-[10px] font-mono font-semibold rounded border uppercase",
                            methodColors[endpoint.method] || "bg-white/5 text-white/60 border-white/20"
                        )}>
                            {endpoint.method}
                        </span>

                        {/* Endpoint path */}
                        <code className="flex-1 text-sm font-mono text-white/80 group-hover:text-white transition-colors truncate overflow-safe">
                            {endpoint.path}
                        </code>

                        {/* Source flow indicator */}
                        <div className="hidden sm:flex items-center gap-1">
                            <SourceBadge source="frontend" active={hasFrontend} />
                            <ChevronRight className="w-3 h-3 text-white/20" />
                            <SourceBadge source="backend" active={hasBackend} />
                            {hasRuntime && (
                                <>
                                    <ChevronRight className="w-3 h-3 text-white/20" />
                                    <SourceBadge source="runtime" active={true} />
                                </>
                            )}
                        </div>

                        {/* Mismatch count */}
                        {mismatchCount > 0 && (
                            <span className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                status === "violation" ? "bg-[var(--error)]/20 text-[var(--error)]" : "bg-[var(--warning)]/20 text-[var(--warning)]"
                            )}>
                                {mismatchCount} diff{mismatchCount !== 1 ? "s" : ""}
                            </span>
                        )}

                        {/* Status orb */}
                        <StatusOrb status={status} size="sm" />

                        {/* Arrow */}
                        <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
                    </div>

                    {/* Tension indicator line at bottom */}
                    <div className={cn(
                        "h-0.5 transition-all duration-300",
                        status === "match" && "bg-[var(--success)]/50",
                        status === "partial" && "bg-[var(--warning)]/50",
                        status === "violation" && "bg-[var(--error)]/70"
                    )} />
                </div>
            </Link>
        </motion.div>
    );
}

export { EndpointFlowRow as EndpointRow };
