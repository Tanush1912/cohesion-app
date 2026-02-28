"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    FolderPlus,
    Key,
    ScanSearch,
    Layers,
    GitCompareArrows,
    Check,
    ChevronRight,
    ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Endpoint } from "@/lib/types";
import { api } from "@/lib/api";

const DISMISSED_KEY = "cohesion-onboarding-dismissed";
const COLLAPSED_KEY = "cohesion-onboarding-collapsed";
const DIFF_VIEWED_KEY = "cohesion-onboarding-diff-viewed";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    completed: boolean;
    action?: () => void;
    actionLabel?: string;
}

interface OnboardingChecklistProps {
    projectCount: number;
    projectEndpoints: Record<string, Endpoint[]>;
    onCreateProject: () => void;
    firstProjectId?: string;
}

export function OnboardingChecklist({
    projectCount,
    projectEndpoints,
    onCreateProject,
    firstProjectId,
}: OnboardingChecklistProps) {
    const router = useRouter();
    const [dismissed, setDismissed] = useState(true);
    const [collapsed, setCollapsed] = useState(false);
    const [diffViewed, setDiffViewed] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);

    useEffect(() => {
        setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
        setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
        setDiffViewed(localStorage.getItem(DIFF_VIEWED_KEY) === "true");

        api.userSettings.get()
            .then((s) => setHasApiKey(Boolean(s.gemini_api_key?.trim())))
            .catch(() => {});
    }, []);

    useEffect(() => {
        const syncApiKeyState = () => {
            api.userSettings.get()
                .then((s) => setHasApiKey(Boolean(s.gemini_api_key?.trim())))
                .catch(() => {});
        };

        window.addEventListener("focus", syncApiKeyState);
        return () => {
            window.removeEventListener("focus", syncApiKeyState);
        };
    }, []);

    useEffect(() => {
        const handler = () => setDiffViewed(true);
        window.addEventListener("cohesion:diff-viewed", handler);
        return () => window.removeEventListener("cohesion:diff-viewed", handler);
    }, []);

    const allEndpoints = useMemo(
        () => Object.values(projectEndpoints).flat(),
        [projectEndpoints],
    );

    const hasProject = projectCount > 0;
    const hasSchema = allEndpoints.some(
        (e) => e.schemas && e.schemas.length > 0,
    );
    const hasMultipleSources = allEndpoints.some((e) => {
        if (!e.schemas) return false;
        const sources = new Set(e.schemas.map((s) => s.source));
        sources.delete("handshake");
        return sources.size >= 2;
    });
    const hasDiffViewed = diffViewed;

    const diffEndpoint = useMemo(() => {
        for (const [projectId, endpoints] of Object.entries(projectEndpoints)) {
            for (const ep of endpoints) {
                if (!ep.schemas) continue;
                const sources = new Set(ep.schemas.map((s) => s.source));
                sources.delete("handshake");
                if (sources.size >= 2) {
                    return { projectId, endpointId: ep.id };
                }
            }
        }
        return null;
    }, [projectEndpoints]);

    const steps: OnboardingStep[] = [
        {
            id: "create-project",
            title: "Create a project",
            description: "Set up your first project to start tracking API contracts",
            icon: <FolderPlus className="w-3.5 h-3.5" />,
            completed: hasProject,
            action: onCreateProject,
            actionLabel: "Create",
        },
        {
            id: "add-gemini-api-key",
            title: "Add Gemini API key (required)",
            description:
                "Required: add your Gemini API key in Settings. Analysis will not work without this step.",
            icon: <Key className="w-3.5 h-3.5" />,
            completed: hasApiKey,
            action: () => router.push("/settings"),
            actionLabel: "Add Key",
        },
        {
            id: "scan-codebase",
            title: "Scan a codebase",
            description: "Point Cohesion at your backend or frontend source code",
            icon: <ScanSearch className="w-3.5 h-3.5" />,
            completed: hasSchema,
            action: firstProjectId
                ? () => router.push(`/projects/${firstProjectId}`)
                : undefined,
            actionLabel: "Upload",
        },
        {
            id: "add-second-source",
            title: "Add a second source",
            description: "Import both frontend and backend to unlock contract diffing",
            icon: <Layers className="w-3.5 h-3.5" />,
            completed: hasMultipleSources,
            action: firstProjectId
                ? () => router.push(`/projects/${firstProjectId}`)
                : undefined,
            actionLabel: "Upload",
        },
        {
            id: "view-diff",
            title: "View your first diff",
            description: "See where your frontend and backend contracts diverge",
            icon: <GitCompareArrows className="w-3.5 h-3.5" />,
            completed: hasDiffViewed,
            action: diffEndpoint
                ? () =>
                      router.push(
                          `/projects/${diffEndpoint.projectId}/endpoints/${diffEndpoint.endpointId}`,
                      )
                : undefined,
            actionLabel: "View",
        },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const allComplete = completedCount === steps.length;

    if (dismissed || allComplete) return null;

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, "true");
        setDismissed(true);
    };

    const handleToggleCollapse = () => {
        const next = !collapsed;
        localStorage.setItem(COLLAPSED_KEY, String(next));
        setCollapsed(next);
    };

    const progress = (completedCount / steps.length) * 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6"
        >
            <div className="border border-white/10 rounded-lg bg-white/[0.02] overflow-hidden">
                {/* Header — clickable to collapse */}
                <button
                    onClick={handleToggleCollapse}
                    className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <motion.div
                            animate={{ rotate: collapsed ? -90 : 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <ChevronDown className="w-3 h-3 text-white/30" />
                        </motion.div>
                        <h3 className="text-xs font-semibold text-white">
                            Getting Started
                        </h3>
                        <span className="text-[10px] font-mono text-white/30">
                            {completedCount}/{steps.length}
                        </span>
                    </div>
                    <div
                        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                        className="text-white/20 hover:text-white/50 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </div>
                </button>

                {/* Progress bar */}
                <div className="h-0.5 bg-white/[0.04]">
                    <motion.div
                        className="h-full bg-white/20"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>

                {/* Steps — collapsible */}
                <AnimatePresence initial={false}>
                    {!collapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                        >
                            <div className="p-2">
                                {steps.map((step, index) => {
                                    // First incomplete step is the "active" one
                                    const isNext =
                                        !step.completed &&
                                        steps.slice(0, index).every((s) => s.completed);

                                    return (
                                        <div
                                            key={step.id}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                                                isNext
                                                    ? "bg-white/[0.04]"
                                                    : ""
                                            }`}
                                        >
                                            {/* Status indicator */}
                                            <div
                                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                                    step.completed
                                                        ? "bg-green-500/20 text-green-400"
                                                        : isNext
                                                          ? "border border-white/20 text-white/40"
                                                          : "border border-white/10 text-white/15"
                                                }`}
                                            >
                                                {step.completed ? (
                                                    <Check className="w-3 h-3" />
                                                ) : (
                                                    step.icon
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <span
                                                    className={`text-xs font-medium ${
                                                        step.completed
                                                            ? "text-white/30 line-through"
                                                            : isNext
                                                              ? "text-white"
                                                              : "text-white/40"
                                                    }`}
                                                >
                                                    {step.title}
                                                </span>
                                                {isNext && (
                                                    <motion.p
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        className="text-[11px] text-white/30 mt-0.5"
                                                    >
                                                        {step.description}
                                                    </motion.p>
                                                )}
                                            </div>

                                            {/* Action button */}
                                            {isNext && step.action && (
                                                <button
                                                    onClick={step.action}
                                                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white/60 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] rounded transition-colors"
                                                >
                                                    {step.actionLabel}
                                                    <ChevronRight className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

export function markDiffViewed() {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DIFF_VIEWED_KEY) === "true") return;
    localStorage.setItem(DIFF_VIEWED_KEY, "true");
    window.dispatchEvent(new Event("cohesion:diff-viewed"));
}
