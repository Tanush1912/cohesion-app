"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiffPanel } from "@/components/visualization/diff-panel";
import { api } from "@/lib/api";
import { DiffResult, LiveDiffResponse } from "@/lib/types";

interface LiveDiffViewProps {
    projectId: string;
    sourceA: string;
    sourceB: string;
    requestCountA: number;
    requestCountB: number;
}

export function LiveDiffView({
    projectId,
    sourceA,
    sourceB,
    requestCountA,
    requestCountB,
}: LiveDiffViewProps) {
    const [diffResponse, setDiffResponse] = useState<LiveDiffResponse | null>(
        null
    );
    const [isComputing, setIsComputing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEndpoint, setSelectedEndpoint] = useState<number>(0);

    const canCompute = requestCountA > 0 && requestCountB > 0;

    const computeDiff = async () => {
        setIsComputing(true);
        setError(null);
        try {
            const result = await api.live.liveDiff(
                projectId,
                sourceA,
                sourceB
            );
            setDiffResponse(result);
            setSelectedEndpoint(0);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsComputing(false);
        }
    };

    const results = diffResponse?.results ?? [];
    const currentDiff: DiffResult | null = results[selectedEndpoint] ?? null;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-white/70">{sourceA}</span>
                    <span className="text-[10px] text-white/20">
                        ({requestCountA})
                    </span>
                </div>
                <ArrowRightLeft className="w-3 h-3 text-white/25" />
                <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-white/70">{sourceB}</span>
                    <span className="text-[10px] text-white/20">
                        ({requestCountB})
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {error && (
                        <span className="text-[11px] text-red-400">
                            {error}
                        </span>
                    )}
                    <Button
                        size="sm"
                        variant="primary"
                        onClick={computeDiff}
                        disabled={isComputing || !canCompute}
                    >
                        {isComputing ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Computing...
                            </>
                        ) : (
                            <>
                                <Zap className="w-3 h-3" />
                                Compute Diff
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Content */}
            {!diffResponse && !isComputing ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <ArrowRightLeft className="w-8 h-8 text-white/10 mx-auto mb-3" />
                        <p className="text-sm text-white/40">
                            Compare schemas from two sources
                        </p>
                        <p className="text-xs text-white/25 mt-1">
                            {canCompute
                                ? "Click Compute Diff to compare inferred schemas"
                                : "Capture traffic from both sources first"}
                        </p>
                    </div>
                </div>
            ) : isComputing ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-6 h-6 text-white/20 mx-auto mb-2 animate-spin" />
                        <p className="text-xs text-white/40">
                            Inferring schemas and computing diff...
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    {/* Endpoint list */}
                    <div className="w-64 border-r border-white/10 flex flex-col shrink-0">
                        <div className="px-3 py-2 border-b border-white/10">
                            <span className="text-[11px] text-white/40">
                                Endpoints ({results.length})
                            </span>
                        </div>
                        <div className="flex-1 overflow-auto">
                            {results.map((result, i) => {
                                const statusColor =
                                    result.status === "match"
                                        ? "text-green-500"
                                        : result.status === "partial"
                                          ? "text-amber-400"
                                          : "text-red-400";
                                const statusSymbol =
                                    result.status === "match"
                                        ? "\u2713"
                                        : result.status === "partial"
                                          ? "\u25CB"
                                          : "\u2715";

                                return (
                                    <motion.div
                                        key={`${result.method}-${result.endpoint}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                        onClick={() =>
                                            setSelectedEndpoint(i)
                                        }
                                        className={`px-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                                            selectedEndpoint === i
                                                ? "bg-white/10"
                                                : ""
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`font-mono text-xs ${statusColor}`}
                                            >
                                                {statusSymbol}
                                            </span>
                                            <span className="text-[10px] font-mono text-white/40 uppercase shrink-0">
                                                {result.method}
                                            </span>
                                            <span className="text-xs font-mono text-white/70 truncate">
                                                {result.endpoint}
                                            </span>
                                        </div>
                                        {(result.mismatches?.length ?? 0) >
                                            0 && (
                                            <span className="text-[10px] text-white/25 ml-6">
                                                {result.mismatches.length}{" "}
                                                mismatch
                                                {result.mismatches.length !== 1
                                                    ? "es"
                                                    : ""}
                                            </span>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Diff detail */}
                    <div className="flex-1 overflow-auto p-4">
                        {currentDiff ? (
                            <DiffPanel diff={currentDiff} />
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-xs text-white/30">
                                    Select an endpoint to view diff
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
