"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Link2, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface ProxySource {
    label: string;
    targetUrl: string;
    proxyUrl: string;
}

interface SourceConfigProps {
    projectId: string;
    sources: ProxySource[];
    onSourceAdded: (source: ProxySource) => void;
    onSourceRemoved: (label: string) => void;
}

export function SourceConfig({
    projectId,
    sources,
    onSourceAdded,
    onSourceRemoved,
}: SourceConfigProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [label, setLabel] = useState("");
    const [targetUrl, setTargetUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!label.trim() || !targetUrl.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await api.live.configureProxy(
                projectId,
                label.trim(),
                targetUrl.trim()
            );
            onSourceAdded({
                label: label.trim(),
                targetUrl: targetUrl.trim(),
                proxyUrl: result.proxy_url,
            });
            setLabel("");
            setTargetUrl("");
            setIsAdding(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const copyProxyUrl = (source: ProxySource) => {
        navigator.clipboard.writeText(source.proxyUrl);
        setCopiedLabel(source.label);
        setTimeout(() => setCopiedLabel(null), 2000);
    };

    return (
        <div className="border border-white/10 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-xs font-medium text-white/70">
                        Proxy Sources
                    </span>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                        Add
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 space-y-2 bg-white/[0.02]">
                            <Input
                                placeholder="Label (e.g. staging-api)"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="h-8 text-xs"
                            />
                            <Input
                                placeholder="Target URL (e.g. http://localhost:3001)"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                className="h-8 text-xs"
                            />
                            {error && (
                                <p className="text-[11px] text-red-400">
                                    {error}
                                </p>
                            )}
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={handleAdd}
                                    disabled={
                                        isSubmitting ||
                                        !label.trim() ||
                                        !targetUrl.trim()
                                    }
                                    className="text-xs h-7"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        "Configure"
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setIsAdding(false);
                                        setError(null);
                                    }}
                                    className="text-xs h-7"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {sources.length === 0 && !isAdding ? (
                <div className="px-3 py-4 text-center">
                    <p className="text-xs text-white/30">
                        No proxy sources configured
                    </p>
                    <p className="text-[11px] text-white/20 mt-0.5">
                        Add a proxy to capture traffic from external services
                    </p>
                </div>
            ) : (
                <div>
                    {sources.map((source) => (
                        <div
                            key={source.label}
                            className="px-3 py-2 border-t border-white/5 flex items-center gap-2 group"
                        >
                            <span className="text-xs font-mono text-white/70 shrink-0">
                                {source.label}
                            </span>
                            <span className="text-[11px] text-white/25 truncate flex-1">
                                {source.targetUrl}
                            </span>
                            <button
                                onClick={() => copyProxyUrl(source)}
                                className="text-white/20 hover:text-white/60 transition-colors shrink-0"
                                title="Copy proxy URL"
                            >
                                {copiedLabel === source.label ? (
                                    <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                    <Copy className="w-3 h-3" />
                                )}
                            </button>
                            <button
                                onClick={() => onSourceRemoved(source.label)}
                                className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
