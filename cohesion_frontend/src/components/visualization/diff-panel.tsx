"use client";

import { motion } from "framer-motion";
import { DiffResult, Mismatch, MatchStatus } from "@/lib/types";

interface DiffPanelProps {
    diff: DiffResult | null;
    isLoading?: boolean;
}

function MismatchItem({ mismatch, index }: { mismatch: Mismatch; index: number }) {
    const getStyle = () => {
        const severity = mismatch.severity;
        if (severity === "info") return { symbol: "i", class: "text-blue-400" };
        if (severity === "warning") return { symbol: "○", class: "text-amber-400" };
        if (severity === "critical") return { symbol: "✕", class: "text-red-400" };

        switch (mismatch.type) {
            case "missing":
            case "type_mismatch":
                return { symbol: "✕", class: "text-red-400" };
            case "optionality_mismatch":
            case "extra_field":
                return { symbol: "○", class: "text-amber-400" };
            default:
                return { symbol: "?", class: "text-white/40" };
        }
    };

    const st = getStyle();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.03 }}
            className="px-3 py-2 border-b border-white/5 last:border-b-0"
        >
            <div className="flex items-start gap-2">
                <span className={`font-mono text-sm ${st.class} shrink-0`}>{st.symbol}</span>
                <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono text-white/80">{mismatch.path}</code>
                    <p className="text-xs text-white/40 mt-0.5">{mismatch.description}</p>
                    {mismatch.suggestion && (
                        <p className="text-xs text-white/25 mt-0.5 italic">{mismatch.suggestion}</p>
                    )}
                    {mismatch.in_sources && mismatch.in_sources.length > 0 && (
                        <div className="flex gap-1 mt-1">
                            {mismatch.in_sources.map((source) => (
                                <span key={source} className="text-[10px] font-mono text-white/30">
                                    {source.replace("-static", "").replace("-observed", "")}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

export function DiffPanel({ diff, isLoading }: DiffPanelProps) {
    if (isLoading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
                ))}
            </div>
        );
    }

    if (!diff) {
        return (
            <div className="text-center py-8">
                <p className="text-sm text-white/40">No diff computed</p>
                <p className="text-xs text-white/30 mt-1">Upload multiple schema sources to compare</p>
            </div>
        );
    }

    const statusConfig: Record<MatchStatus, { symbol: string; label: string; class: string }> = {
        match: { symbol: "✓", label: "All matched", class: "text-green-500" },
        partial: { symbol: "○", label: "Partial match", class: "text-amber-400" },
        violation: { symbol: "✕", label: "Contract violation", class: "text-red-400" },
    };

    const st = statusConfig[diff.status];
    const mismatches = diff.mismatches ?? [];

    return (
        <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                <span className={`text-lg font-mono ${st.class}`}>{st.symbol}</span>
                <span className="text-sm font-medium text-white">{st.label}</span>
                <span className="text-xs text-white/40 ml-auto">
                    {mismatches.filter(m => m.severity === "critical").length > 0 && (
                        <span className="text-red-400 mr-2">{mismatches.filter(m => m.severity === "critical").length} critical</span>
                    )}
                    {mismatches.filter(m => !m.severity || m.severity !== "info").length > 0
                        ? `${mismatches.length} total`
                        : `${mismatches.length} issues`
                    }
                </span>
            </div>

            {diff.sources_compared && diff.sources_compared.length > 0 && (
                <div className="flex items-center gap-2 mb-4 text-xs">
                    <span className="text-white/40">Sources:</span>
                    {diff.sources_compared.map((source) => (
                        <span key={source} className="font-mono text-white/60">
                            {source.replace("-static", "").replace("-observed", "")}
                        </span>
                    ))}
                </div>
            )}

            {mismatches.length > 0 ? (
                <div className="border border-white/10 rounded overflow-hidden">
                    {mismatches.map((mismatch, index) => (
                        <MismatchItem key={mismatch.path} mismatch={mismatch} index={index} />
                    ))}
                </div>
            ) : diff.status === "match" ? (
                <div className="text-center py-6 border border-white/10 rounded">
                    <span className="text-green-500 text-lg font-mono">✓</span>
                    <p className="text-sm text-white/60 mt-2">All schemas aligned</p>
                </div>
            ) : null}
        </div>
    );
}
