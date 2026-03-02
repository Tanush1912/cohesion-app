"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, Zap, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HandshakeView } from "@/components/visualization/handshake-view";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { SchemaIR, DiffResult, LiveDiffResponse } from "@/lib/types";

interface LiveHandshakeViewProps {
    projectId: string;
    frontendSource: string;
    backendSource: string;
    requestCountA: number;
    requestCountB: number;
}

interface EndpointEntry {
    endpoint: string;
    method: string;
    feSchema: SchemaIR | null;
    beSchema: SchemaIR | null;
    diff: DiffResult | null;
}

export function LiveHandshakeView({
    projectId,
    frontendSource,
    backendSource,
    requestCountA,
    requestCountB,
}: LiveHandshakeViewProps) {
    const [feSchemas, setFeSchemas] = useState<SchemaIR[]>([]);
    const [beSchemas, setBeSchemas] = useState<SchemaIR[]>([]);
    const [diffResponse, setDiffResponse] = useState<LiveDiffResponse | null>(
        null
    );
    const [isComputing, setIsComputing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedEndpoint, setSelectedEndpoint] = useState<number>(0);
    const [hasComputed, setHasComputed] = useState(false);

    const canCompute = requestCountA > 0 && requestCountB > 0;

    const computeHandshake = async () => {
        setIsComputing(true);
        setError(null);
        try {
            const [feSch, beSch, diffRes] = await Promise.all([
                api.live.liveSchemas(projectId, frontendSource),
                api.live.liveSchemas(projectId, backendSource),
                api.live.liveDiff(projectId, backendSource, frontendSource),
            ]);
            setFeSchemas(feSch);
            setBeSchemas(beSch);
            setDiffResponse(diffRes);
            setSelectedEndpoint(0);
            setHasComputed(true);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsComputing(false);
        }
    };

    const endpoints: EndpointEntry[] = useMemo(() => {
        if (!hasComputed) return [];

        const map = new Map<string, EndpointEntry>();
        const key = (endpoint: string, method: string) =>
            `${method}:${endpoint}`;

        for (const s of feSchemas) {
            const k = key(s.endpoint, s.method);
            if (!map.has(k)) {
                map.set(k, {
                    endpoint: s.endpoint,
                    method: s.method,
                    feSchema: s,
                    beSchema: null,
                    diff: null,
                });
            } else {
                map.get(k)!.feSchema = s;
            }
        }

        for (const s of beSchemas) {
            const k = key(s.endpoint, s.method);
            if (!map.has(k)) {
                map.set(k, {
                    endpoint: s.endpoint,
                    method: s.method,
                    feSchema: null,
                    beSchema: s,
                    diff: null,
                });
            } else {
                map.get(k)!.beSchema = s;
            }
        }

        if (diffResponse) {
            for (const d of diffResponse.results) {
                const k = key(d.endpoint, d.method);
                if (map.has(k)) {
                    map.get(k)!.diff = d;
                }
            }
        }

        return Array.from(map.values()).sort((a, b) =>
            `${a.method}:${a.endpoint}`.localeCompare(
                `${b.method}:${b.endpoint}`
            )
        );
    }, [feSchemas, beSchemas, diffResponse, hasComputed]);

    const currentEntry = endpoints[selectedEndpoint] ?? null;

    const getResponseSchema = (schema: SchemaIR | null) => {
        if (!schema?.response) return null;
        const codes = Object.keys(schema.response).map(Number).sort();
        const successCode = codes.find((c) => c >= 200 && c < 300) ?? codes[0];
        return successCode != null ? schema.response[successCode] : null;
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] text-white/30 uppercase tracking-wide">
                        Frontend
                    </span>
                    <span className="font-mono text-white/70">
                        {frontendSource}
                    </span>
                    <span className="text-[10px] text-white/20">
                        ({requestCountA})
                    </span>
                </div>
                <Workflow className="w-3 h-3 text-white/25" />
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-[10px] text-white/30 uppercase tracking-wide">
                        Backend
                    </span>
                    <span className="font-mono text-white/70">
                        {backendSource}
                    </span>
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
                        onClick={computeHandshake}
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
                                Compute Handshake
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Content */}
            {!hasComputed && !isComputing ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Workflow className="w-8 h-8 text-white/10 mx-auto mb-3" />
                        <p className="text-sm text-white/40">
                            Visualize the API handshake between sources
                        </p>
                        <p className="text-xs text-white/25 mt-1">
                            {canCompute
                                ? "Click Compute Handshake to see how frontend and backend schemas align"
                                : "Capture traffic from both sources first"}
                        </p>
                        <p className="text-[10px] text-white/15 mt-3 max-w-[340px] mx-auto">
                            Assign which source represents your frontend and
                            backend using the dropdowns above
                        </p>
                    </div>
                </div>
            ) : isComputing ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="w-6 h-6 text-white/20 mx-auto mb-2 animate-spin" />
                        <p className="text-xs text-white/40">
                            Inferring schemas and building handshake
                            visualization...
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex overflow-hidden">
                    {/* Endpoint list */}
                    <div className="w-64 border-r border-white/10 flex flex-col shrink-0">
                        <div className="px-3 py-2 border-b border-white/10">
                            <span className="text-[11px] text-white/40">
                                Endpoints ({endpoints.length})
                            </span>
                        </div>
                        <div className="flex-1 overflow-auto">
                            {endpoints.map((entry, i) => {
                                const status = entry.diff?.status;
                                const statusColor =
                                    status === "match"
                                        ? "text-green-500"
                                        : status === "partial"
                                          ? "text-amber-400"
                                          : status === "violation"
                                            ? "text-red-400"
                                            : "text-white/20";
                                const statusSymbol =
                                    status === "match"
                                        ? "\u2713"
                                        : status === "partial"
                                          ? "\u25CB"
                                          : status === "violation"
                                            ? "\u2715"
                                            : "\u2022";

                                const hasFe = !!entry.feSchema;
                                const hasBe = !!entry.beSchema;

                                return (
                                    <motion.div
                                        key={`${entry.method}-${entry.endpoint}`}
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
                                            <Badge
                                                variant="method"
                                                method={entry.method}
                                                className="text-[9px] shrink-0"
                                            >
                                                {entry.method}
                                            </Badge>
                                            <span className="text-xs font-mono text-white/70 truncate">
                                                {entry.endpoint}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 ml-6 mt-0.5">
                                            {!hasFe && (
                                                <span className="text-[9px] text-amber-400/60">
                                                    no frontend
                                                </span>
                                            )}
                                            {!hasBe && (
                                                <span className="text-[9px] text-amber-400/60">
                                                    no backend
                                                </span>
                                            )}
                                            {entry.diff &&
                                                (entry.diff.mismatches
                                                    ?.length ?? 0) > 0 && (
                                                    <span className="text-[10px] text-white/25">
                                                        {
                                                            entry.diff
                                                                .mismatches
                                                                .length
                                                        }{" "}
                                                        mismatch
                                                        {entry.diff.mismatches
                                                            .length !== 1
                                                            ? "es"
                                                            : ""}
                                                    </span>
                                                )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                            {endpoints.length === 0 && (
                                <div className="p-4 text-center">
                                    <p className="text-xs text-white/30">
                                        No endpoints inferred yet
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Handshake visualization */}
                    <div className="flex-1 overflow-auto">
                        {currentEntry ? (
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Badge
                                        variant="method"
                                        method={currentEntry.method}
                                    >
                                        {currentEntry.method}
                                    </Badge>
                                    <span className="text-sm font-mono text-white/80">
                                        {currentEntry.endpoint}
                                    </span>
                                    {currentEntry.diff && (
                                        <span
                                            className={`text-[10px] font-mono ml-auto ${
                                                currentEntry.diff.status ===
                                                "match"
                                                    ? "text-green-400/70"
                                                    : currentEntry.diff
                                                            .status ===
                                                        "partial"
                                                      ? "text-amber-400/70"
                                                      : "text-red-400/70"
                                            }`}
                                        >
                                            {currentEntry.diff.status}
                                        </span>
                                    )}
                                </div>
                                <HandshakeView
                                    feSchema={
                                        getResponseSchema(
                                            currentEntry.feSchema
                                        ) ??
                                        currentEntry.feSchema?.request ??
                                        null
                                    }
                                    beSchema={
                                        getResponseSchema(
                                            currentEntry.beSchema
                                        ) ??
                                        currentEntry.beSchema?.request ??
                                        null
                                    }
                                    rtSchema={null}
                                    mismatches={
                                        currentEntry.diff?.mismatches ?? []
                                    }
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center h-full">
                                <p className="text-xs text-white/30">
                                    Select an endpoint to view the handshake
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
