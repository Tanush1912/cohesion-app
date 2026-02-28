"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { CopyForAI } from "@/components/ui/copy-for-ai";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SourceTabs, SchemaView } from "@/components/endpoint/schema-panel";
import { DiffPanel } from "@/components/visualization/diff-panel";
import { ContractSchema, ContractFlow } from "@/components/visualization/contract-schema";
import { HandshakeView } from "@/components/visualization/handshake-view";
import { markDiffViewed } from "@/components/dashboard/onboarding-checklist";
import { useAppStore } from "@/stores/app-store";
import { SchemaSource, ObjectSchema, SchemaIR } from "@/lib/types";


export default function EndpointDetailPage() {
    const params = useParams();
    const projectId = params.projectId as string;
    const endpointId = params.endpointId as string;

    const {
        currentProject,
        currentEndpoint,
        currentDiff,
        isLoading,
        fetchProject,
        fetchEndpoint,
        computeDiff,
    } = useAppStore();

    const [activeSource, setActiveSource] = useState<SchemaSource>("backend-static");
    const [viewMode, setViewMode] = useState<"flow" | "list" | "code">("flow");


    useEffect(() => {
        if (projectId) fetchProject(projectId);
        if (endpointId) fetchEndpoint(endpointId);
    }, [projectId, endpointId, fetchProject, fetchEndpoint]);

    const getSchemaForSource = (source: SchemaSource, type: "request" | "response"): ObjectSchema | null => {
        if (!currentEndpoint?.schemas) return null;
        const schema = currentEndpoint.schemas.find((s) => s.source === source);
        if (!schema?.schema_data) return null;
        const data = schema.schema_data as unknown as SchemaIR;

        if (type === "request") return data.request || null;
        if (type === "response" && data.response) {
            return data.response[200] || data.response[201] || Object.values(data.response)[0] || null;
        }
        return null;
    };

    const schemas: { source: SchemaSource; hasData: boolean }[] = [
        {
            source: "backend-static",
            hasData: !!(getSchemaForSource("backend-static", "request") || getSchemaForSource("backend-static", "response"))
        },
        {
            source: "frontend-static",
            hasData: !!(getSchemaForSource("frontend-static", "request") || getSchemaForSource("frontend-static", "response"))
        },
        {
            source: "runtime-observed",
            hasData: !!(getSchemaForSource("runtime-observed", "request") || getSchemaForSource("runtime-observed", "response"))
        },
        {
            source: "handshake",
            hasData: true
        }
    ];

    const sourcesWithData = schemas.filter(s => s.source !== "handshake" && s.hasData).length;
    useEffect(() => {
        if (endpointId && currentEndpoint && sourcesWithData >= 2 && !currentDiff) {
            computeDiff(endpointId);
        }
    }, [endpointId, currentEndpoint, sourcesWithData, currentDiff, computeDiff]);

    useEffect(() => {
        if (currentDiff) markDiffViewed();
    }, [currentDiff]);

    const activeRequestSchema = getSchemaForSource(activeSource, "request");
    const activeResponseSchema = getSchemaForSource(activeSource, "response");

    const hasAnyData = activeSource === "handshake"
        ? schemas.some(s => s.source !== "handshake" && s.hasData)
        : !!(activeRequestSchema || activeResponseSchema);

    const statusSymbols = {
        match: { symbol: "✓", class: "text-green-500" },
        partial: { symbol: "○", class: "text-amber-400" },
        violation: { symbol: "✕", class: "text-red-400" },
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header
                title={
                    currentEndpoint ? (
                        <span className="flex items-center gap-2 font-mono">
                            <Badge variant="method" method={currentEndpoint.method}>
                                {currentEndpoint.method}
                            </Badge>
                            <span className="text-white/80">{currentEndpoint.path}</span>
                            {currentDiff && (
                                <span className={`ml-2 ${statusSymbols[currentDiff.status].class}`}>
                                    {statusSymbols[currentDiff.status].symbol}
                                </span>
                            )}
                        </span>
                    ) : "..."
                }
                breadcrumbs={[
                    { label: "Dashboard", href: "/" },
                    { label: currentProject?.name || "Project", href: `/projects/${projectId}` },
                    { label: currentEndpoint?.path || "Endpoint" },
                ]}
                actions={
                    <div className="flex items-center gap-2">
                        <CopyForAI endpoint={currentEndpoint} diffResult={currentDiff} />
                        {schemas.filter(s => s.hasData).length > 1 && (
                            <Button variant="secondary" size="sm" onClick={() => computeDiff(endpointId)}>
                                <RefreshCw className="w-3 h-3" />
                                Diff
                            </Button>
                        )}
                    </div>
                }
            />

            <div className="flex-1 flex overflow-hidden">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-1/2 border-r border-white/10 flex flex-col"
                >
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <span className="text-xs font-medium text-white/60">Contract</span>
                        <div className="flex gap-1 text-[10px] font-mono">
                            <button
                                onClick={() => setViewMode("flow")}
                                className={viewMode === "flow" ? "text-white" : "text-white/40 hover:text-white/60"}
                            >
                                flow
                            </button>
                            <span className="text-white/20">|</span>
                            <button
                                onClick={() => setViewMode("list")}
                                className={viewMode === "list" ? "text-white" : "text-white/40 hover:text-white/60"}
                            >
                                list
                            </button>
                            <span className="text-white/20">|</span>
                            <button
                                onClick={() => setViewMode("code")}
                                className={viewMode === "code" ? "text-white" : "text-white/40 hover:text-white/60"}
                            >
                                code
                            </button>
                        </div>
                    </div>

                    <div className="p-3 border-b border-white/10">
                        <SourceTabs
                            schemas={schemas.map(s => ({
                                source: s.source,
                                schema: s.hasData ? ({} as any) : null
                            }))}
                            activeSource={activeSource}
                            onSourceChange={setActiveSource}
                        />
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        {!hasAnyData ? (
                            <div className="flex items-center justify-center h-full text-white/40 text-sm">
                                No schema data available for this source
                            </div>
                        ) : activeSource === "handshake" ? (
                            <HandshakeView
                                feSchema={getSchemaForSource("frontend-static", "response") || getSchemaForSource("frontend-static", "request")}
                                beSchema={getSchemaForSource("backend-static", "response") || getSchemaForSource("backend-static", "request")}
                                rtSchema={getSchemaForSource("runtime-observed", "response") || getSchemaForSource("runtime-observed", "request")}
                                mismatches={currentDiff?.mismatches}
                            />
                        ) : viewMode === "flow" ? (
                            <ContractFlow
                                requestSchema={activeRequestSchema}
                                responseSchema={activeResponseSchema}
                                source={activeSource}
                                method={currentEndpoint?.method}
                                path={currentEndpoint?.path}
                                mismatches={currentDiff?.mismatches}
                            />
                        ) : viewMode === "list" ? (
                            <div className="space-y-8">
                                {activeRequestSchema && (
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Request Body</div>
                                        <ContractSchema
                                            schema={activeRequestSchema}
                                            source={activeSource}
                                            mismatches={currentDiff?.mismatches}
                                            title="Request"
                                        />
                                    </div>
                                )}
                                {activeResponseSchema && (
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Response Body (200 OK)</div>
                                        <ContractSchema
                                            schema={activeResponseSchema}
                                            source={activeSource}
                                            mismatches={currentDiff?.mismatches}
                                            title="Response"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {activeRequestSchema && (
                                    <SchemaView
                                        schema={activeRequestSchema}
                                        title="Request"
                                        mismatches={currentDiff?.mismatches}
                                    />
                                )}
                                {activeResponseSchema && (
                                    <SchemaView
                                        schema={activeResponseSchema}
                                        title="Response"
                                        mismatches={currentDiff?.mismatches}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-1/2 flex flex-col"
                >
                    <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <span className="text-xs font-medium text-white/60">Analysis</span>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        <DiffPanel diff={currentDiff} isLoading={isLoading} />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
