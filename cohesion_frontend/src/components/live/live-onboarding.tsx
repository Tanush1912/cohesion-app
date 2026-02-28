"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

const DISMISSED_KEY = "cohesion-live-onboarding-dismissed";

type ViewMode = "unified" | "dual" | "diff";

interface LiveOnboardingProps {
    hasProject: boolean;
    isCapturing: boolean;
    hasInferred: boolean;
    viewMode?: ViewMode;
    hasConfiguredSources?: boolean;
}

interface Step {
    label: string;
}

function getSteps(viewMode: ViewMode): Step[] {
    if (viewMode === "dual" || viewMode === "diff") {
        return [
            { label: "Select a project" },
            { label: "Configure sources" },
            { label: "Start capture" },
            { label: viewMode === "diff" ? "Compute diff" : "Compare traffic" },
        ];
    }
    return [
        { label: "Select a project" },
        { label: "Start capture" },
        { label: "Infer schemas" },
    ];
}

function getCompleted(
    viewMode: ViewMode,
    hasProject: boolean,
    isCapturing: boolean,
    hasInferred: boolean,
    hasConfiguredSources: boolean
): boolean[] {
    if (viewMode === "dual" || viewMode === "diff") {
        return [
            hasProject,
            hasConfiguredSources,
            isCapturing || hasInferred,
            hasInferred,
        ];
    }
    return [hasProject, isCapturing || hasInferred, hasInferred];
}

export function LiveOnboarding({
    hasProject,
    isCapturing,
    hasInferred,
    viewMode = "unified",
    hasConfiguredSources = false,
}: LiveOnboardingProps) {
    const [dismissed, setDismissed] = useState(true);

    useEffect(() => {
        setDismissed(localStorage.getItem(DISMISSED_KEY) === "true");
    }, []);

    const steps = getSteps(viewMode);
    const completed = getCompleted(
        viewMode,
        hasProject,
        isCapturing,
        hasInferred,
        hasConfiguredSources
    );
    const allDone = completed.every(Boolean);

    useEffect(() => {
        if (hasInferred && !dismissed) {
            localStorage.setItem(DISMISSED_KEY, "true");
            const t = setTimeout(() => setDismissed(true), 1200);
            return () => clearTimeout(t);
        }
    }, [hasInferred, dismissed]);

    if (dismissed || allDone) return null;

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, "true");
        setDismissed(true);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-white/[0.06] bg-white/[0.015]"
            >
                <div className="flex items-center gap-1 px-4 py-2">
                    {steps.map((step, i) => {
                        const done = completed[i];
                        const active =
                            !done && completed.slice(0, i).every(Boolean);

                        return (
                            <div key={step.label} className="flex items-center gap-1">
                                {i > 0 && (
                                    <span className="text-white/10 text-[10px] mx-1.5">
                                        ›
                                    </span>
                                )}
                                <div
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-colors ${
                                        done
                                            ? "text-green-400/70"
                                            : active
                                              ? "text-white bg-white/[0.06]"
                                              : "text-white/25"
                                    }`}
                                >
                                    {done ? (
                                        <Check className="w-3 h-3" />
                                    ) : (
                                        <span className="w-3 text-center text-[10px] font-mono opacity-50">
                                            {i + 1}
                                        </span>
                                    )}
                                    {step.label}
                                </div>
                            </div>
                        );
                    })}

                    <button
                        onClick={handleDismiss}
                        className="ml-auto text-white/15 hover:text-white/40 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
