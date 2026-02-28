"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LiveCapturedRequest } from "@/lib/types";

interface DualTrafficViewProps {
    sourceA: string;
    sourceB: string;
    requestsA: LiveCapturedRequest[];
    requestsB: LiveCapturedRequest[];
    isCapturing?: boolean;
}

function RequestList({
    label,
    count,
    requests,
    selectedId,
    onSelect,
    isCapturing,
}: {
    label: string;
    count: number;
    requests: LiveCapturedRequest[];
    selectedId: string | null;
    onSelect: (req: LiveCapturedRequest) => void;
    isCapturing?: boolean;
}) {
    const getStatusColor = (code: number) => {
        if (code >= 200 && code < 300) return "text-green-500";
        if (code >= 400 && code < 500) return "text-amber-400";
        return "text-red-400";
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/10 last:border-r-0">
            <div className="h-9 px-3 flex items-center justify-between border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white/50">
                        {label}
                    </span>
                    <span className="text-[10px] text-white/25">
                        ({count})
                    </span>
                </div>
                {isCapturing && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
            </div>
            <div className="flex-1 overflow-auto">
                {requests.length === 0 ? (
                    <div className="p-6 text-center">
                        <Activity className="w-5 h-5 text-white/15 mx-auto mb-2" />
                        <p className="text-[11px] text-white/30">
                            No requests from {label}
                        </p>
                    </div>
                ) : (
                    requests.map((req) => (
                        <motion.div
                            key={req.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => onSelect(req)}
                            className={`px-3 py-1.5 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${
                                selectedId === req.id ? "bg-white/10" : ""
                            }`}
                        >
                            <div className="flex items-center gap-1.5 text-[11px] font-mono">
                                <Badge
                                    variant="method"
                                    method={req.method}
                                    className="text-[9px] px-1 py-0"
                                >
                                    {req.method}
                                </Badge>
                                <span className="flex-1 text-white/70 truncate">
                                    {req.path}
                                </span>
                                <span
                                    className={getStatusColor(req.status_code)}
                                >
                                    {req.status_code}
                                </span>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}

function RequestDetail({
    request,
}: {
    request: LiveCapturedRequest | null;
}) {
    const formatBody = (body?: Record<string, unknown>) => {
        if (!body || Object.keys(body).length === 0) return "No body";
        return JSON.stringify(body, null, 2);
    };

    const getStatusColor = (code: number) => {
        if (code >= 200 && code < 300) return "text-green-500";
        if (code >= 400 && code < 500) return "text-amber-400";
        return "text-red-400";
    };

    if (!request) {
        return (
            <div className="text-center py-8">
                <p className="text-xs text-white/30">
                    Select a request to view details
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 p-3 overflow-hidden w-full">
            <div>
                <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="method" method={request.method}>
                        {request.method}
                    </Badge>
                    <code className="text-xs font-mono text-white/80 break-all">
                        {request.path}
                    </code>
                    {request.source && (
                        <span className="text-[10px] font-mono text-white/30 ml-auto shrink-0">
                            {request.source}
                        </span>
                    )}
                </div>
            </div>

            <div>
                <span className="text-[10px] text-white/40 block mb-1">
                    Request Body
                </span>
                <pre className="text-[11px] font-mono bg-[oklch(0.12_0_0)] border border-white/10 rounded p-2 max-h-60 overflow-y-auto whitespace-pre-wrap break-all">
                    {formatBody(request.request_body)}
                </pre>
            </div>

            <div>
                <span className="text-[10px] text-white/40 block mb-1">
                    Response
                </span>
                <div className="flex items-center gap-2 mb-1">
                    <span
                        className={`text-xs font-mono ${getStatusColor(request.status_code)}`}
                    >
                        {request.status_code}
                    </span>
                    {request.duration_ms > 0 && (
                        <span className="text-[10px] text-white/30">
                            {Math.round(request.duration_ms)}ms
                        </span>
                    )}
                </div>
                <pre className="text-[11px] font-mono bg-[oklch(0.12_0_0)] border border-white/10 rounded p-2 max-h-[70vh] overflow-y-auto whitespace-pre-wrap break-all">
                    {formatBody(request.response_body)}
                </pre>
            </div>

            {request.timestamp && (
                <div className="text-[10px] text-white/20 font-mono">
                    {new Date(request.timestamp).toLocaleString()}
                </div>
            )}
        </div>
    );
}

export function DualTrafficView({
    sourceA,
    sourceB,
    requestsA,
    requestsB,
    isCapturing,
}: DualTrafficViewProps) {
    const [selectedRequest, setSelectedRequest] =
        useState<LiveCapturedRequest | null>(null);

    return (
        <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex">
                <RequestList
                    label={sourceA}
                    count={requestsA.length}
                    requests={requestsA}
                    selectedId={selectedRequest?.id ?? null}
                    onSelect={setSelectedRequest}
                    isCapturing={isCapturing}
                />
                <RequestList
                    label={sourceB}
                    count={requestsB.length}
                    requests={requestsB}
                    selectedId={selectedRequest?.id ?? null}
                    onSelect={setSelectedRequest}
                    isCapturing={isCapturing}
                />
            </div>

            <div className="w-[480px] border-l border-white/10 flex flex-col shrink-0 overflow-hidden">
                <div className="h-9 px-3 flex items-center border-b border-white/10 shrink-0">
                    <span className="text-xs text-white/50">Details</span>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <RequestDetail request={selectedRequest} />
                </div>
            </div>
        </div>
    );
}
