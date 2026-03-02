"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Activity,
    Circle,
    Pause,
    Play,
    Trash2,
    Zap,
    Loader2,
    ChevronDown,
    Columns2,
    ArrowRightLeft,
    Radio,
    Workflow,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveOnboarding } from "@/components/live/live-onboarding";
import { SourceConfig } from "@/components/live/source-config";
import { DualTrafficView } from "@/components/live/dual-traffic-view";
import { LiveDiffView } from "@/components/live/live-diff-view";
import { LiveHandshakeView } from "@/components/live/live-handshake-view";
import { useAppStore } from "@/stores/app-store";
import { api } from "@/lib/api";
import { LiveCapturedRequest } from "@/lib/types";
import { enableFrontendCapture, disableFrontendCapture } from "@/lib/live-capture";

type ViewMode = "unified" | "dual" | "diff" | "handshake";

interface ProxySource {
    label: string;
    targetUrl: string;
    proxyUrl: string;
}

const VIEW_TABS: { id: ViewMode; label: string; icon: typeof Radio }[] = [
    { id: "unified", label: "Unified", icon: Radio },
    { id: "dual", label: "Dual Sources", icon: Columns2 },
    { id: "diff", label: "Live Diff", icon: ArrowRightLeft },
    { id: "handshake", label: "Live Handshake", icon: Workflow },
];

export default function LivePage() {
    const [viewMode, setViewMode] = useState<ViewMode>("unified");
    const [isCapturing, setIsCapturing] = useState(false);
    const [requests, setRequests] = useState<LiveCapturedRequest[]>([]);
    const [selectedRequest, setSelectedRequest] =
        useState<LiveCapturedRequest | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
        null
    );
    const [isInferring, setIsInferring] = useState(false);
    const [inferResult, setInferResult] = useState<string | null>(null);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [proxySources, setProxySources] = useState<ProxySource[]>([]);
    const [selectedSourceA, setSelectedSourceA] = useState("self");
    const [selectedSourceB, setSelectedSourceB] = useState("frontend");
    const eventSourceRef = useRef<EventSource | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const { projects, fetchProjects } = useAppStore();

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    useEffect(() => {
        if (projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projects[0].id);
        }
    }, [projects, selectedProjectId]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setShowProjectDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    useEffect(() => {
        if (!selectedProjectId) return;
        api.live
            .getRequests(selectedProjectId)
            .then((data) => {
                setRequests(data.reverse());
            })
            .catch(() => {
                setRequests([]);
            });
    }, [selectedProjectId]);

    // When a proxy source is added, auto-select it as source B
    useEffect(() => {
        if (proxySources.length > 0 && !selectedSourceB) {
            setSelectedSourceB(proxySources[0].label);
        }
    }, [proxySources, selectedSourceB]);

    const startSSE = useCallback(async () => {
        if (!selectedProjectId) return;

        const url = await api.live.streamUrl(selectedProjectId);
        const es = new EventSource(url);

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === "request" && data.payload) {
                    setRequests((prev) =>
                        [data.payload, ...prev].slice(0, 200)
                    );
                } else if (data.type === "clear") {
                    setRequests([]);
                    setSelectedRequest(null);
                }
            } catch {
                /* ignore parse errors */
            }
        };

        es.onerror = () => {
            /* SSE reconnects automatically */
        };

        eventSourceRef.current = es;
    }, [selectedProjectId]);

    const stopSSE = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            stopSSE();
            disableFrontendCapture();
            api.live.stopCapture().catch(() => {});
        };
    }, [stopSSE]);

    const toggleCapture = async () => {
        if (!selectedProjectId) return;
        if (isCapturing) {
            stopSSE();
            disableFrontendCapture();
            await api.live.stopCapture().catch(() => {});
            setIsCapturing(false);
        } else {
            await api.live.startCapture(selectedProjectId).catch(() => {});
            enableFrontendCapture(selectedProjectId);
            startSSE();
            setIsCapturing(true);
        }
    };

    const clearRequests = async () => {
        if (selectedProjectId) {
            try {
                await api.live.clear(selectedProjectId);
            } catch {
                /* ignore */
            }
        }
        setRequests([]);
        setSelectedRequest(null);
    };

    const handleInfer = async () => {
        if (!selectedProjectId || requests.length === 0) return;
        setIsInferring(true);
        setInferResult(null);
        try {
            const result = await api.live.infer(selectedProjectId);
            setInferResult(
                `Inferred ${result.count} endpoint schema${result.count !== 1 ? "s" : ""} from ${requests.length} captured requests`
            );
        } catch (e) {
            setInferResult(`Inference failed: ${(e as Error).message}`);
        } finally {
            setIsInferring(false);
        }
    };

    const getStatusColor = (code: number) => {
        if (code >= 200 && code < 300) return "text-green-500";
        if (code >= 400 && code < 500) return "text-amber-400";
        return "text-red-400";
    };

    const formatBody = (body?: Record<string, unknown>) => {
        if (!body || Object.keys(body).length === 0) return "No body";
        return JSON.stringify(body, null, 2);
    };

    const selectedProject = projects.find((p) => p.id === selectedProjectId);

    // Filter requests by source for dual/diff views
    const requestsBySource = useMemo(() => {
        const bySource: Record<string, LiveCapturedRequest[]> = {};
        for (const req of requests) {
            const source = req.source || "self";
            if (!bySource[source]) bySource[source] = [];
            bySource[source].push(req);
        }
        return bySource;
    }, [requests]);

    const availableSources = useMemo(() => {
        const sources = new Set(["self", "frontend"]);
        for (const req of requests) {
            if (req.source) sources.add(req.source);
        }
        for (const ps of proxySources) {
            sources.add(ps.label);
        }
        return Array.from(sources);
    }, [requests, proxySources]);

    const handleSourceAdded = (source: ProxySource) => {
        setProxySources((prev) => [...prev, source]);
    };

    const handleSourceRemoved = (label: string) => {
        setProxySources((prev) => prev.filter((s) => s.label !== label));
        if (selectedSourceA === label) setSelectedSourceA("self");
        if (selectedSourceB === label) setSelectedSourceB("");
    };

    const isDualOrDiff = viewMode === "dual" || viewMode === "diff" || viewMode === "handshake";

    return (
        <div className="min-h-screen flex flex-col">
            <Header
                title="Live Capture"
                description="Monitor runtime API traffic and infer schemas"
                actions={
                    <div className="flex items-center gap-2">
                        {/* Project dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() =>
                                    setShowProjectDropdown(!showProjectDropdown)
                                }
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md hover:bg-white/10 transition-colors"
                            >
                                <span className="text-white/60">Project:</span>
                                <span className="text-white/90 max-w-[120px] truncate">
                                    {selectedProject?.name || "Select..."}
                                </span>
                                <ChevronDown className="w-3 h-3 text-white/40" />
                            </button>
                            {showProjectDropdown && (
                                <div className="absolute top-full mt-1 right-0 min-w-[180px] bg-[oklch(0.15_0_0)] border border-white/10 rounded-md shadow-xl z-50 py-1">
                                    {projects.map((p) => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setSelectedProjectId(p.id);
                                                setShowProjectDropdown(false);
                                                if (isCapturing) {
                                                    stopSSE();
                                                    disableFrontendCapture();
                                                    api.live
                                                        .stopCapture()
                                                        .catch(() => {});
                                                    setIsCapturing(false);
                                                }
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors ${
                                                p.id === selectedProjectId
                                                    ? "text-white bg-white/5"
                                                    : "text-white/70"
                                            }`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                    {projects.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-white/40">
                                            No projects
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <Button
                            variant={isCapturing ? "destructive" : "primary"}
                            size="sm"
                            onClick={toggleCapture}
                            disabled={!selectedProjectId}
                        >
                            {isCapturing ? (
                                <>
                                    <Pause className="w-3 h-3" />
                                    Stop
                                </>
                            ) : (
                                <>
                                    <Play className="w-3 h-3" />
                                    Start Capture
                                </>
                            )}
                        </Button>
                        {requests.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearRequests}
                            >
                                <Trash2 className="w-3 h-3" />
                                Clear
                            </Button>
                        )}
                    </div>
                }
            />

            <LiveOnboarding
                hasProject={!!selectedProjectId}
                isCapturing={isCapturing}
                hasInferred={!!inferResult}
                viewMode={viewMode}
                hasConfiguredSources={proxySources.length > 0}
            />

            {/* View mode tabs */}
            <div className="border-b border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center">
                    <div className="flex">
                        {VIEW_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = viewMode === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setViewMode(tab.id)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                                        isActive
                                            ? "border-white text-white"
                                            : "border-transparent text-white/40 hover:text-white/60"
                                    }`}
                                >
                                    <Icon className="w-3 h-3" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Source selectors for dual/diff/handshake mode */}
                    {isDualOrDiff && availableSources.length > 1 && (
                        <div className="flex items-center gap-2 ml-auto px-3">
                            {viewMode === "handshake" && (
                                <span className="text-[10px] text-white/30 uppercase tracking-wide">
                                    Frontend
                                </span>
                            )}
                            <select
                                value={selectedSourceA}
                                onChange={(e) =>
                                    setSelectedSourceA(e.target.value)
                                }
                                className="text-[11px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-white/30"
                            >
                                {availableSources.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[10px] text-white/20">
                                {viewMode === "handshake" ? "\u2194" : "vs"}
                            </span>
                            {viewMode === "handshake" && (
                                <span className="text-[10px] text-white/30 uppercase tracking-wide">
                                    Backend
                                </span>
                            )}
                            <select
                                value={selectedSourceB}
                                onChange={(e) =>
                                    setSelectedSourceB(e.target.value)
                                }
                                className="text-[11px] bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-white/30"
                            >
                                {availableSources
                                    .filter((s) => s !== selectedSourceA)
                                    .map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                {availableSources.filter(
                                    (s) => s !== selectedSourceA
                                ).length === 0 && (
                                    <option value="" disabled>
                                        No other source
                                    </option>
                                )}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Source config panel for dual/diff modes */}
            {isDualOrDiff && selectedProjectId && (
                <div className="border-b border-white/[0.06] px-4 py-3">
                    <SourceConfig
                        projectId={selectedProjectId}
                        sources={proxySources}
                        onSourceAdded={handleSourceAdded}
                        onSourceRemoved={handleSourceRemoved}
                    />
                </div>
            )}

            {/* View content */}
            {viewMode === "unified" && (
                <div className="flex-1 flex overflow-hidden">
                    {/* Request list */}
                    <div className="w-1/2 border-r border-white/10 flex flex-col">
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                            <span className="text-xs text-white/50">
                                Requests ({requests.length})
                            </span>
                            {isCapturing && (
                                <span className="flex items-center gap-1 text-xs text-green-400">
                                    <Circle className="w-2 h-2 fill-current animate-pulse" />
                                    Listening
                                </span>
                            )}
                        </div>

                        <div className="flex-1 overflow-auto">
                            {requests.length === 0 ? (
                                <div className="p-8 text-center">
                                    <Activity className="w-8 h-8 text-white/20 mx-auto mb-3" />
                                    <p className="text-sm text-white/40">
                                        No requests captured
                                    </p>
                                    <p className="text-xs text-white/30 mt-1">
                                        {isCapturing
                                            ? "Listening for traffic from your instrumented app..."
                                            : "Start capture to listen for runtime requests"}
                                    </p>
                                    {!isCapturing && selectedProjectId && (
                                        <p className="text-xs text-white/20 mt-3 font-mono">
                                            POST /api/live/ingest
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    {requests.map((req) => (
                                        <motion.div
                                            key={req.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            onClick={() =>
                                                setSelectedRequest(req)
                                            }
                                            className={`px-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                                                selectedRequest?.id === req.id
                                                    ? "bg-white/10"
                                                    : ""
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 text-xs font-mono">
                                                <Badge
                                                    variant="method"
                                                    method={req.method}
                                                    className="text-[10px]"
                                                >
                                                    {req.method}
                                                </Badge>
                                                <span className="flex-1 text-white/80 truncate">
                                                    {req.path}
                                                </span>
                                                {req.source &&
                                                    req.source !== "self" && (
                                                        <span className="text-[10px] text-white/25 font-mono">
                                                            {req.source}
                                                        </span>
                                                    )}
                                                <span
                                                    className={getStatusColor(
                                                        req.status_code
                                                    )}
                                                >
                                                    {req.status_code}
                                                </span>
                                                {req.duration_ms > 0 && (
                                                    <span className="text-white/30">
                                                        {Math.round(
                                                            req.duration_ms
                                                        )}
                                                        ms
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Request details */}
                    <div className="w-1/2 flex flex-col">
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                            <span className="text-xs text-white/50">
                                Details
                            </span>
                        </div>

                        <div className="flex-1 overflow-auto p-4">
                            {selectedRequest ? (
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-xs text-white/40 block mb-1">
                                            Request
                                        </span>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge
                                                variant="method"
                                                method={
                                                    selectedRequest.method
                                                }
                                            >
                                                {selectedRequest.method}
                                            </Badge>
                                            <code className="text-sm font-mono text-white/80">
                                                {selectedRequest.path}
                                            </code>
                                            {selectedRequest.source && (
                                                <span className="text-[10px] font-mono text-white/30 ml-auto">
                                                    source:{" "}
                                                    {selectedRequest.source}
                                                </span>
                                            )}
                                        </div>
                                        <pre className="text-xs font-mono bg-[oklch(0.12_0_0)] border border-white/10 rounded p-3 overflow-auto">
                                            {formatBody(
                                                selectedRequest.request_body
                                            )}
                                        </pre>
                                    </div>

                                    <div>
                                        <span className="text-xs text-white/40 block mb-1">
                                            Response
                                        </span>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span
                                                className={`font-mono ${getStatusColor(selectedRequest.status_code)}`}
                                            >
                                                {selectedRequest.status_code}
                                            </span>
                                            {selectedRequest.duration_ms >
                                                0 && (
                                                <span className="text-xs text-white/40">
                                                    {Math.round(
                                                        selectedRequest.duration_ms
                                                    )}
                                                    ms
                                                </span>
                                            )}
                                        </div>
                                        <pre className="text-xs font-mono bg-[oklch(0.12_0_0)] border border-white/10 rounded p-3 overflow-auto">
                                            {formatBody(
                                                selectedRequest.response_body
                                            )}
                                        </pre>
                                    </div>

                                    {selectedRequest.timestamp && (
                                        <div className="text-xs text-white/30 font-mono">
                                            {new Date(
                                                selectedRequest.timestamp
                                            ).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-white/40">
                                        Select a request to view details
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Infer Schema bar */}
                        {requests.length > 0 && selectedProjectId && (
                            <div className="p-3 border-t border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleInfer}
                                        disabled={isInferring}
                                    >
                                        {isInferring ? (
                                            <>
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Inferring...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-3 h-3" />
                                                Infer Schema
                                            </>
                                        )}
                                    </Button>
                                    <span className="text-xs text-white/30">
                                        from {requests.length} request
                                        {requests.length !== 1 ? "s" : ""}
                                    </span>
                                </div>
                                {inferResult && (
                                    <span className="text-xs text-white/50">
                                        {inferResult}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {viewMode === "dual" && (
                <DualTrafficView
                    sourceA={selectedSourceA}
                    sourceB={selectedSourceB || "(none)"}
                    requestsA={requestsBySource[selectedSourceA] ?? []}
                    requestsB={requestsBySource[selectedSourceB] ?? []}
                    isCapturing={isCapturing}
                />
            )}

            {viewMode === "diff" && selectedProjectId && (
                <LiveDiffView
                    projectId={selectedProjectId}
                    sourceA={selectedSourceA}
                    sourceB={selectedSourceB || "self"}
                    requestCountA={
                        (requestsBySource[selectedSourceA] ?? []).length
                    }
                    requestCountB={
                        (requestsBySource[selectedSourceB] ?? []).length
                    }
                />
            )}

            {viewMode === "handshake" && selectedProjectId && (
                <LiveHandshakeView
                    projectId={selectedProjectId}
                    frontendSource={selectedSourceA}
                    backendSource={selectedSourceB || "self"}
                    requestCountA={
                        (requestsBySource[selectedSourceA] ?? []).length
                    }
                    requestCountB={
                        (requestsBySource[selectedSourceB] ?? []).length
                    }
                />
            )}
        </div>
    );
}
