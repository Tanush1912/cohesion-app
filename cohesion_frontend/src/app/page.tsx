"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FolderKanban, AlertTriangle, Shield, Activity, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectCard } from "@/components/dashboard/project-card";
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { StatusOrb, ContractHealth } from "@/components/ui/status-indicators";
import { useAppStore } from "@/stores/app-store";
import { MatchStatus, Endpoint } from "@/lib/types";
import { api } from "@/lib/api";

interface RiskIndicatorProps {
  label: string;
  value: number;
  status: MatchStatus;
  icon: React.ReactNode;
}

function RiskIndicator({ label, value, status, icon }: RiskIndicatorProps) {
  const statusColors = {
    match: "text-[var(--success)]",
    partial: "text-[var(--warning)]",
    violation: "text-[var(--error)]",
  };

  return (
    <Card status={value > 0 ? status : undefined} className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-white/5 ${statusColors[status]}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/50 uppercase tracking-wide">{label}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-2xl font-mono font-bold ${value > 0 ? statusColors[status] : "text-white/30"}`}>
              {value}
            </span>
            {value > 0 && status !== "match" && (
              <StatusOrb status={status} size="sm" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { projects, isLoading, fetchProjects } = useAppStore();
  const [stats, setStats] = useState({ matched: 0, partial: 0, violations: 0 });
  const [projectEndpoints, setProjectEndpoints] = useState<Record<string, Endpoint[]>>({});
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (projects.length === 0) return;
    Promise.all(
      projects.map((p) =>
        api.endpoints.list(p.id).then((endpoints) => [p.id, endpoints] as const)
      )
    ).then((results) => {
      const map: Record<string, Endpoint[]> = {};
      for (const [id, endpoints] of results) {
        map[id] = endpoints;
      }
      setProjectEndpoints(map);
    }).catch(() => {
    });
  }, [projects]);

  useEffect(() => {
    if (projects.length === 0) {
      setStats({ matched: 0, partial: 0, violations: 0 });
      return;
    }
    api.stats.get().then(setStats).catch(() => {});
  }, [projects]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        title="Dashboard"
        description="Visualize and validate API contracts across your system"
        actions={<CreateProjectDialog externalOpen={createOpen} onExternalOpenChange={setCreateOpen} />}
      />

      <div className="flex-1 section-padding">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"
        >
          <RiskIndicator
            label="Matched"
            value={stats.matched}
            status="match"
            icon={<Shield className="w-4 h-4" />}
          />
          <RiskIndicator
            label="Partial"
            value={stats.partial}
            status="partial"
            icon={<Activity className="w-4 h-4" />}
          />
          <RiskIndicator
            label="Violations"
            value={stats.violations}
            status="violation"
            icon={<AlertTriangle className="w-4 h-4" />}
          />
        </motion.div>

        {/* Onboarding Checklist */}
        {!isLoading && (
          <OnboardingChecklist
            projectCount={projects.length}
            projectEndpoints={projectEndpoints}
            onCreateProject={() => setCreateOpen(true)}
            firstProjectId={projects[0]?.id}
          />
        )}

        {/* Contract Health Overview */}
        {(stats.matched > 0 || stats.partial > 0 || stats.violations > 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <ContractHealth
              matchCount={stats.matched}
              partialCount={stats.partial}
              violationCount={stats.violations}
            />
          </motion.div>
        )}

        {/* Projects Section */}
        <div className="border-b border-[var(--border)] pb-2 mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Projects</h2>
          <span className="text-xs text-white/40 font-mono">{projects.length}</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="h-32 rounded-lg bg-[var(--surface)] animate-pulse"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-[var(--border)] border-dashed rounded-lg p-12 text-center"
          >
            <FolderKanban className="w-10 h-10 text-white/15 mx-auto mb-4" />
            <h3 className="text-base font-medium text-white/80 mb-2">No projects yet</h3>
            <p className="text-sm text-white/40 mb-6 max-w-sm mx-auto">
              Create a project to start visualizing your API contracts
            </p>
            <Button size="md" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project, index) => {
              const endpoints = projectEndpoints[project.id] ?? [];
              const schemas = endpoints.flatMap((e) => e.schemas ?? []);
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  endpointCount={endpoints.length}
                  sources={{
                    hasBackend: schemas.some((s) => s.source === "backend-static"),
                    hasFrontend: schemas.some((s) => s.source === "frontend-static"),
                    hasRuntime: schemas.some((s) => s.source === "runtime-observed"),
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
