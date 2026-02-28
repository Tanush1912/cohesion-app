"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Endpoint, SchemaIR, DiffResult } from "@/lib/types";
import { api } from "@/lib/api";

type CopyTarget = "backend" | "frontend" | "both" | "violations";

interface CopyForAIProps {
    endpoint?: Endpoint | null;
    endpoints?: Endpoint[];
    diffResult?: DiffResult | null;
}

function buildSchemaOutput(endpoints: Endpoint[], sourceFilter: "backend-static" | "frontend-static" | null): object[] {
    const result: object[] = [];

    for (const ep of endpoints) {
        if (!ep.schemas) continue;
        for (const schema of ep.schemas) {
            if (sourceFilter && schema.source !== sourceFilter) continue;
            if (!sourceFilter && schema.source !== "backend-static" && schema.source !== "frontend-static") continue;

            const data = schema.schema_data as unknown as SchemaIR;
            result.push({
                endpoint: data.endpoint || ep.path,
                method: data.method || ep.method,
                source: schema.source,
                ...(data.request ? { request: data.request } : {}),
                ...(data.response ? { response: data.response } : {}),
            });
        }
    }

    return result;
}

function buildViolationsOutput(endpoints: Endpoint[], diffs: Map<string, DiffResult>): object[] {
    const result: object[] = [];

    for (const ep of endpoints) {
        const diff = diffs.get(ep.id);
        if (!diff || diff.status === "match") continue;
        if (!ep.schemas) continue;

        for (const schema of ep.schemas) {
            if (schema.source !== "backend-static" && schema.source !== "frontend-static") continue;
            const data = schema.schema_data as unknown as SchemaIR;
            result.push({
                endpoint: data.endpoint || ep.path,
                method: data.method || ep.method,
                source: schema.source,
                diff_status: diff.status,
                mismatches: diff.mismatches,
                ...(data.request ? { request: data.request } : {}),
                ...(data.response ? { response: data.response } : {}),
            });
        }
    }

    return result;
}

export function CopyForAI({ endpoint, endpoints, diffResult }: CopyForAIProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const allEndpoints = endpoint ? [endpoint] : endpoints ?? [];

    const hasBE = allEndpoints.some(ep => ep.schemas?.some(s => s.source === "backend-static"));
    const hasFE = allEndpoints.some(ep => ep.schemas?.some(s => s.source === "frontend-static"));
    const hasMultipleSources = allEndpoints.some(ep => {
        const sources = new Set(ep.schemas?.map(s => s.source) ?? []);
        return sources.size >= 2;
    });

    if (!hasBE && !hasFE) return null;

    const handleCopy = async (target: CopyTarget) => {
        if (target === "violations") {
            await handleCopyViolations();
            return;
        }

        let sourceFilter: "backend-static" | "frontend-static" | null = null;
        if (target === "backend") sourceFilter = "backend-static";
        if (target === "frontend") sourceFilter = "frontend-static";

        const output = buildSchemaOutput(allEndpoints, sourceFilter);
        const json = JSON.stringify(output, null, 2);

        await navigator.clipboard.writeText(json);
        setOpen(false);

        const label = target === "both" ? "Backend + Frontend" : target === "backend" ? "Backend" : "Frontend";
        const count = output.length;
        toast.success(`${label} schema copied`, {
            description: `${count} endpoint${count !== 1 ? "s" : ""} copied to clipboard`,
        });
    };

    const handleCopyViolations = async () => {
        setLoading(true);
        try {
            const diffs = new Map<string, DiffResult>();

            if (endpoint && diffResult) {
                diffs.set(endpoint.id, diffResult);
            } else {
                const diffable = allEndpoints.filter(ep => {
                    const sources = new Set(ep.schemas?.map(s => s.source) ?? []);
                    return sources.size >= 2;
                });

                const results = await Promise.all(
                    diffable.map(ep =>
                        api.diff.compute(ep.id)
                            .then(diff => [ep.id, diff] as const)
                            .catch(() => null)
                    )
                );

                for (const r of results) {
                    if (r) diffs.set(r[0], r[1]);
                }
            }

            const output = buildViolationsOutput(allEndpoints, diffs);
            if (output.length === 0) {
                toast.info("No violations found", {
                    description: "All endpoints are fully matched",
                });
                setOpen(false);
                return;
            }

            const json = JSON.stringify(output, null, 2);
            await navigator.clipboard.writeText(json);
            setOpen(false);

            const endpointCount = new Set(output.map((o: any) => o.endpoint + o.method)).size;
            toast.success("Violations copied", {
                description: `${endpointCount} mismatched endpoint${endpointCount !== 1 ? "s" : ""} copied to clipboard`,
            });
        } catch {
            toast.error("Failed to fetch diffs");
        } finally {
            setLoading(false);
        }
    };

    const options: { key: CopyTarget; label: string; available: boolean }[] = [
        { key: "backend", label: "Backend Schema", available: hasBE },
        { key: "frontend", label: "Frontend Schema", available: hasFE },
        { key: "both", label: "Both", available: hasBE && hasFE },
        { key: "violations", label: "Violations Only", available: hasMultipleSources },
    ];

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(!open)}
                className="gap-1"
            >
                <Copy className="w-3 h-3" />
                <span className="hidden sm:inline">Copy for AI</span>
                <ChevronDown className="w-3 h-3 text-white/40" />
            </Button>

            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                    {options.map((opt) => (
                        <button
                            key={opt.key}
                            disabled={!opt.available || loading}
                            onClick={() => opt.available && !loading && handleCopy(opt.key)}
                            className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors flex items-center gap-2 ${
                                opt.available && !loading
                                    ? "text-white/70 hover:bg-white/5 hover:text-white"
                                    : "text-white/20 cursor-not-allowed"
                            }`}
                        >
                            {loading && opt.key === "violations" && (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
