"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, GitBranch, Server, Monitor, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, TensionBar } from "@/components/ui/card";
import { StatusOrb, SourceBadge } from "@/components/ui/status-indicators";
import { Project, MatchStatus, SchemaSource } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface ProjectCardProps {
    project: Project;
    index: number;
    endpointCount?: number;
    status?: MatchStatus;
    sources?: {
        hasBackend: boolean;
        hasFrontend: boolean;
        hasRuntime: boolean;
    };
}

export function ProjectCard({
    project,
    index,
    endpointCount = 0,
    status = "match",
    sources = { hasBackend: false, hasFrontend: false, hasRuntime: false }
}: ProjectCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.2 }}
        >
            <Link href={`/projects/${project.id}`}>
                <Card
                    status={status}
                    className="group cursor-pointer hover:bg-[var(--surface-elevated)] transition-all duration-200"
                >
                    <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="flex items-center gap-2">
                                    <span className="truncate">{project.name}</span>
                                    <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-white/50 flex-shrink-0" />
                                </CardTitle>
                                <CardDescription className="truncate">
                                    {project.description || "No description"}
                                </CardDescription>
                            </div>
                            <StatusOrb status={status} size="md" />
                        </div>
                    </CardHeader>

                    <CardContent>
                        {/* Source coverage indicators */}
                        <div className="flex items-center gap-1.5 mb-3">
                            <SourceBadge source="backend" active={sources.hasBackend} />
                            <SourceBadge source="frontend" active={sources.hasFrontend} />
                            <SourceBadge source="runtime" active={sources.hasRuntime} />
                        </div>

                        {/* Contract mini flow visualization */}
                        <div className="flex items-center justify-between text-xs text-white/40 mb-3">
                            <div className="flex items-center gap-1">
                                <GitBranch className="w-3 h-3" />
                                <span className="font-mono">{endpointCount} endpoints</span>
                            </div>
                            <span>{formatRelativeTime(project.updated_at)}</span>
                        </div>

                        {/* Tension bar - shows overall contract health */}
                        <TensionBar status={status} percentage={100} />
                    </CardContent>
                </Card>
            </Link>
        </motion.div>
    );
}
