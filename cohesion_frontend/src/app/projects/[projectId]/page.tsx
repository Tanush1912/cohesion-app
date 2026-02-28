"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, GitBranch, Trash2, Loader2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { CopyForAI } from "@/components/ui/copy-for-ai";
import { Card } from "@/components/ui/card";
import { EndpointRow } from "@/components/project/endpoint-row";
import { UploadSchemaDialog } from "@/components/project/upload-schema-dialog";
import { useAppStore } from "@/stores/app-store";

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;

    const [uploadOpen, setUploadOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const {
        currentProject,
        endpoints,
        isLoading,
        diffMap,
        fetchProject,
        fetchEndpoints,
        fetchDiffsForProject,
        invalidateDiffMap,
        deleteProject,
    } = useAppStore();

    useEffect(() => {
        if (projectId) {
            fetchProject(projectId);
            fetchEndpoints(projectId);
        }
    }, [projectId, fetchProject, fetchEndpoints]);

    useEffect(() => {
        if (endpoints.length > 0 && projectId) {
            fetchDiffsForProject(projectId, endpoints);
        }
    }, [endpoints, projectId, fetchDiffsForProject]);

    const handleUploadSuccess = () => {
        invalidateDiffMap();
        fetchEndpoints(projectId);
    };

    const handleDeleteProject = async () => {
        await deleteProject(projectId);
        router.push("/");
    };

    const backendCount = endpoints.filter((e) => e.schemas?.some((s) => s.source === "backend-static")).length;
    const frontendCount = endpoints.filter((e) => e.schemas?.some((s) => s.source === "frontend-static")).length;
    const runtimeCount = endpoints.filter((e) => e.schemas?.some((s) => s.source === "runtime-observed")).length;

    return (
        <div className="min-h-screen">
            <Header
                title={currentProject?.name || "..."}
                description={currentProject?.description}
                breadcrumbs={[
                    { label: "Dashboard", href: "/" },
                    { label: currentProject?.name || "Project" },
                ]}
                actions={
                    <div className="flex items-center gap-2">
                        <CopyForAI endpoints={endpoints} />
                        <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
                            <Upload className="w-3 h-3" />
                            Upload
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDeleteConfirmOpen(true)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    </div>
                }
            />

            <div className="p-6">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-6 mb-6 text-xs font-mono"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-white/40">Endpoints</span>
                        <span className="text-white font-semibold">{endpoints.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-white/40">BE</span>
                        <span className="text-white/80">{backendCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-white/40">FE</span>
                        <span className="text-white/80">{frontendCount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-white/40">RT</span>
                        <span className="text-white/80">{runtimeCount}</span>
                    </div>
                </motion.div>

                <AnimatePresence>
                    {isUploading && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 overflow-hidden"
                        >
                            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/[0.03]">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-white/50" />
                                <span className="text-xs text-white/50 font-mono">Analyzing codebase...</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <Card className="overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/10 text-xs text-white/40 flex items-center gap-3">
                        <span className="w-14">Method</span>
                        <span className="flex-1">Path</span>
                        <span>Sources</span>
                        <span className="w-6">Status</span>
                        <span className="w-3"></span>
                    </div>

                    {isLoading ? (
                        <div className="p-4">
                            <div className="h-8 bg-white/5 rounded animate-pulse mb-2" />
                            <div className="h-8 bg-white/5 rounded animate-pulse mb-2" />
                            <div className="h-8 bg-white/5 rounded animate-pulse" />
                        </div>
                    ) : endpoints.length === 0 ? (
                        <div className="p-8 text-center">
                            <GitBranch className="w-6 h-6 text-white/20 mx-auto mb-2" />
                            <p className="text-sm text-white/40">No endpoints</p>
                            <p className="text-xs text-white/30 mt-1 mb-4">Upload schemas to start</p>
                            <Button variant="secondary" size="sm" onClick={() => setUploadOpen(true)}>
                                <Upload className="w-3 h-3" />
                                Upload Schema
                            </Button>
                        </div>
                    ) : (
                        <div>
                            {endpoints.map((endpoint, index) => {
                                const diff = diffMap[endpoint.id];
                                return (
                                    <EndpointRow
                                        key={endpoint.id}
                                        endpoint={endpoint}
                                        projectId={projectId}
                                        index={index}
                                        status={diff?.status}
                                        mismatchCount={diff?.mismatches?.length}
                                    />
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>

            <UploadSchemaDialog
                projectId={projectId}
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onSuccess={handleUploadSuccess}
                onUploadStart={() => setIsUploading(true)}
                onUploadEnd={() => setIsUploading(false)}
            />

            {/* Delete Confirmation Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-[#0a0a0a] border border-white/10 rounded-lg p-6 max-w-md mx-4"
                    >
                        <h3 className="text-lg font-semibold text-white mb-2">Delete Project</h3>
                        <p className="text-sm text-white/60 mb-6">
                            Are you sure you want to delete <span className="text-white font-medium">{currentProject?.name}</span>?
                            This will permanently remove all endpoints and schemas. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleDeleteProject}
                                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300"
                            >
                                Delete Project
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
