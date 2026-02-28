"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Folder, FolderOpen, Server, Monitor, Braces, Github, GitBranch, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { SchemaIR, SchemaSource } from "@/lib/types";

interface UploadSchemaDialogProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    onUploadStart?: () => void;
    onUploadEnd?: () => void;
}

interface UploadedFile {
    path: string;
    content: string;
}

const SOURCE_EXTENSIONS = new Set([
    ".go", ".py", ".ts", ".tsx", ".js", ".jsx",
    ".java", ".rb", ".rs", ".php", ".cs", ".kt",
]);

const SKIP_DIRS = new Set([
    "vendor", ".git", "node_modules", "__pycache__",
    ".venv", "venv", "dist", "build", "target",
    ".idea", ".vscode", ".next", ".nuxt",
]);

const MAX_FILE_SIZE = 100 * 1024;
const MAX_TOTAL_SIZE = 10 * 1024 * 1024;

type ScanTab = "scan-backend" | "scan-frontend" | "github" | "manual";

const hasDirectoryPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

async function readDirectoryRecursive(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string = "",
): Promise<UploadedFile[]> {
    const files: UploadedFile[] = [];
    let totalSize = 0;

    async function walk(handle: FileSystemDirectoryHandle, currentPath: string) {
        for await (const entry of (handle as any).values()) {
            if (totalSize >= MAX_TOTAL_SIZE) break;

            if (entry.kind === "directory") {
                if (SKIP_DIRS.has(entry.name)) continue;
                await walk(entry as FileSystemDirectoryHandle, currentPath ? `${currentPath}/${entry.name}` : entry.name);
            } else if (entry.kind === "file") {
                const ext = entry.name.includes(".") ? "." + entry.name.split(".").pop()!.toLowerCase() : "";
                if (!SOURCE_EXTENSIONS.has(ext)) continue;

                const file = await (entry as FileSystemFileHandle).getFile();
                if (file.size > MAX_FILE_SIZE) continue;
                if (totalSize + file.size > MAX_TOTAL_SIZE) break;

                const content = await file.text();
                const filePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                files.push({ path: filePath, content });
                totalSize += file.size;
            }
        }
    }

    await walk(dirHandle, prefix);
    return files;
}

export function UploadSchemaDialog({ projectId, open, onOpenChange, onSuccess, onUploadStart, onUploadEnd }: UploadSchemaDialogProps) {
    const [tab, setTab] = useState<ScanTab>("scan-backend");
    const [source, setSource] = useState<SchemaSource>("backend-static");
    const [jsonInput, setJsonInput] = useState("");
    const [dirPath, setDirPath] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [folderName, setFolderName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [ghRepoUrl, setGhRepoUrl] = useState("");
    const [ghBranch, setGhBranch] = useState("");
    const [ghPath, setGhPath] = useState("");
    const [ghScanType, setGhScanType] = useState<"backend" | "frontend">("backend");
    const [hasGeminiKey, setHasGeminiKey] = useState(true);

    useEffect(() => {
        if (open) {
            api.userSettings.get().then((settings) => {
                setHasGeminiKey(settings.gemini_api_key !== "");
            }).catch(() => {});
        }
    }, [open]);

    const handlePickFolder = useCallback(async () => {
        try {
            const dirHandle = await (window as any).showDirectoryPicker();
            setFolderName(dirHandle.name);
            setError(null);
            const files = await readDirectoryRecursive(dirHandle);
            if (files.length === 0) {
                setError("No supported source files found in the selected folder");
                setUploadedFiles([]);
                setFolderName(null);
                return;
            }
            setUploadedFiles(files);
        } catch (e: any) {
            if (e.name === "AbortError") return;
            setError("Failed to read folder: " + e.message);
        }
    }, []);

    const handleScanSubmit = async () => {
        const scanType = tab === "scan-frontend" ? "frontend" as const : "backend" as const;

        if (uploadedFiles.length === 0 && !dirPath.trim()) {
            setError("Select a folder or enter a directory path");
            return;
        }

        const filesToSend = [...uploadedFiles];
        const pathToSend = dirPath.trim();

        closeAndReset();
        onUploadStart?.();

        try {
            if (filesToSend.length > 0) {
                await api.schemas.scan(projectId, {
                    files: filesToSend,
                    scan_type: scanType,
                });
            } else {
                await api.schemas.scan(projectId, {
                    dir_path: pathToSend,
                    scan_type: scanType,
                });
            }

            toast.success("Analysis complete", {
                description: `${scanType === "frontend" ? "Frontend" : "Backend"} scan finished successfully`,
            });
            onSuccess?.();
        } catch (e) {
            toast.error("Analysis failed", {
                description: (e as Error).message,
            });
        } finally {
            onUploadEnd?.();
        }
    };

    const handleGitHubSubmit = async () => {
        if (!ghRepoUrl.trim()) {
            setError("Enter a GitHub repository URL or owner/repo");
            return;
        }

        const repoUrl = ghRepoUrl.trim();
        const branch = ghBranch.trim() || undefined;
        const path = ghPath.trim() || undefined;
        const scanType = ghScanType;

        closeAndReset();
        onUploadStart?.();

        try {
            await api.schemas.scanGitHub(projectId, {
                repo_url: repoUrl,
                branch,
                path,
                scan_type: scanType,
            });

            toast.success("Analysis complete", {
                description: `GitHub ${scanType} scan finished successfully`,
            });
            onSuccess?.();
        } catch (e) {
            toast.error("GitHub scan failed", {
                description: (e as Error).message,
            });
        } finally {
            onUploadEnd?.();
        }
    };

    const handleManualSubmit = async () => {
        let schemas: SchemaIR[];
        try {
            const parsed = JSON.parse(jsonInput);
            schemas = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            setError("Invalid JSON format");
            return;
        }

        for (const schema of schemas) {
            if (!schema.endpoint || !schema.method) {
                setError("Each schema must have 'endpoint' and 'method' fields");
                return;
            }
        }

        const sourceToUse = source;

        closeAndReset();
        onUploadStart?.();

        try {
            if (sourceToUse === "backend-static") {
                await api.schemas.uploadBackend(projectId, schemas);
            } else if (sourceToUse === "frontend-static") {
                await api.schemas.uploadFrontend(projectId, schemas);
            } else {
                await api.schemas.uploadRuntime(projectId, schemas);
            }

            toast.success("Schema uploaded", {
                description: `${schemas.length} schema${schemas.length !== 1 ? "s" : ""} uploaded successfully`,
            });
            onSuccess?.();
        } catch (e) {
            toast.error("Upload failed", {
                description: (e as Error).message,
            });
        } finally {
            onUploadEnd?.();
        }
    };

    const closeAndReset = () => {
        onOpenChange(false);
        setJsonInput("");
        setDirPath("");
        setUploadedFiles([]);
        setFolderName(null);
        setError(null);
        setGhRepoUrl("");
        setGhBranch("");
        setGhPath("");
    };

    const resetScanState = () => {
        setUploadedFiles([]);
        setFolderName(null);
        setDirPath("");
        setError(null);
    };

    const isScanTab = tab === "scan-backend" || tab === "scan-frontend";
    const isGitHubTab = tab === "github";
    const canSubmitScan = uploadedFiles.length > 0 || dirPath.trim().length > 0;
    const canSubmitGitHub = ghRepoUrl.trim().length > 0;

    const exampleSchema = {
        endpoint: "/api/users",
        method: "POST",
        request: {
            type: "object",
            fields: {
                email: { type: "string", required: true },
                name: { type: "string", required: true }
            }
        }
    };

    const tabs: { key: ScanTab; label: string; description: string; icon: React.ReactNode }[] = [
        {
            key: "scan-backend",
            label: "Scan Backend",
            description: "Analyze server code to extract endpoints",
            icon: <Server className="w-4 h-4 text-blue-400" />,
        },
        {
            key: "scan-frontend",
            label: "Scan Frontend",
            description: "Analyze client code to extract API calls",
            icon: <Monitor className="w-4 h-4 text-fuchsia-400" />,
        },
        {
            key: "github",
            label: "GitHub Repo",
            description: "Scan a repository directly from GitHub",
            icon: <Github className="w-4 h-4 text-white/70" />,
        },
        {
            key: "manual",
            label: "Manual JSON",
            description: "Paste SchemaIR JSON directly",
            icon: <Braces className="w-4 h-4 text-white/50" />,
        },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Ingest Schemas</DialogTitle>
                    <DialogDescription>
                        Bridge the gap between code and contract
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 space-y-4">
                    {/* Tab cards */}
                    <div className="grid grid-cols-4 gap-2">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => { setTab(t.key); resetScanState(); }}
                                className={`text-left p-3 rounded-lg border transition-colors ${tab === t.key
                                    ? "border-white/20 bg-white/[0.06]"
                                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    {t.icon}
                                    <span className={`text-xs font-semibold ${tab === t.key ? "text-white" : "text-white/60"}`}>
                                        {t.label}
                                    </span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-white/30">
                                    {t.description}
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* Scan tab content (backend or frontend) */}
                    {isScanTab && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 border border-white/10 rounded bg-white/5">
                                <p className="text-xs text-white/80 leading-relaxed">
                                    {tab === "scan-backend"
                                        ? <>Analyze a <strong>backend</strong> codebase to extract the HTTP endpoints it <strong>serves</strong>.</>
                                        : <>Analyze a <strong>frontend</strong> codebase to extract the API calls it <strong>makes</strong>.</>
                                    }
                                </p>
                            </div>

                            {!hasGeminiKey && (
                                <div className="flex items-center gap-2 p-2.5 border border-amber-500/30 rounded bg-amber-500/10">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                    <p className="text-xs text-amber-300">
                                        No Gemini API key configured. Add one in{" "}
                                        <a href="/settings" className="underline hover:text-amber-200">Settings</a>{" "}
                                        before scanning.
                                    </p>
                                </div>
                            )}

                            {/* Folder picker button (if supported) */}
                            {hasDirectoryPicker && (
                                <div>
                                    <label className="block text-xs text-white/50 mb-2">Select Folder</label>
                                    <button
                                        onClick={handlePickFolder}
                                        className="w-full flex items-center gap-3 p-3 border border-dashed border-white/20 rounded hover:border-white/40 hover:bg-white/5 transition-colors text-left"
                                    >
                                        {folderName ? (
                                            <FolderOpen className="w-5 h-5 text-white/60 shrink-0" />
                                        ) : (
                                            <Folder className="w-5 h-5 text-white/30 shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            {folderName ? (
                                                <>
                                                    <span className="text-sm text-white font-mono">{folderName}/</span>
                                                    <span className="text-xs text-white/50 ml-2">{uploadedFiles.length} files</span>
                                                </>
                                            ) : (
                                                <span className="text-sm text-white/40">Click to pick a folder from your computer</span>
                                            )}
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* Divider + manual dir_path fallback */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-[10px] text-white/30 uppercase tracking-wider">
                                    {hasDirectoryPicker ? "or enter path manually" : "enter codebase path"}
                                </span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            <div>
                                <div className="relative">
                                    <Folder className="absolute left-2.5 top-2.5 w-4 h-4 text-white/30" />
                                    <Input
                                        value={dirPath}
                                        onChange={(e) => setDirPath(e.target.value)}
                                        placeholder="/Users/name/projects/my-api"
                                        className="pl-9 font-mono text-xs"
                                    />
                                </div>
                                <p className="text-[10px] text-white/30 mt-1.5 italic">
                                    The Cohesion server must have read access to this directory.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* GitHub tab content */}
                    {isGitHubTab && (
                        <div className="space-y-4 py-2">
                            <div className="p-3 border border-white/10 rounded bg-white/5">
                                <p className="text-xs text-white/80 leading-relaxed">
                                    Scan a GitHub repository to extract API schemas. Requires a{" "}
                                    <a href="/settings" className="text-blue-400 hover:underline">GitHub token</a> in Settings.
                                </p>
                            </div>

                            {!hasGeminiKey && (
                                <div className="flex items-center gap-2 p-2.5 border border-amber-500/30 rounded bg-amber-500/10">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                    <p className="text-xs text-amber-300">
                                        No Gemini API key configured. Add one in{" "}
                                        <a href="/settings" className="underline hover:text-amber-200">Settings</a>{" "}
                                        before scanning.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-white/50 mb-2">Repository</label>
                                <div className="relative">
                                    <Github className="absolute left-2.5 top-2.5 w-4 h-4 text-white/30" />
                                    <Input
                                        value={ghRepoUrl}
                                        onChange={(e) => setGhRepoUrl(e.target.value)}
                                        placeholder="owner/repo or https://github.com/owner/repo"
                                        className="pl-9 font-mono text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-white/50 mb-2">Branch</label>
                                    <div className="relative">
                                        <GitBranch className="absolute left-2.5 top-2.5 w-4 h-4 text-white/30" />
                                        <Input
                                            value={ghBranch}
                                            onChange={(e) => setGhBranch(e.target.value)}
                                            placeholder="main"
                                            className="pl-9 font-mono text-xs"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-white/50 mb-2">Subdirectory</label>
                                    <div className="relative">
                                        <Folder className="absolute left-2.5 top-2.5 w-4 h-4 text-white/30" />
                                        <Input
                                            value={ghPath}
                                            onChange={(e) => setGhPath(e.target.value)}
                                            placeholder="src/ (optional)"
                                            className="pl-9 font-mono text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-white/50 mb-2">Scan Type</label>
                                <div className="flex gap-1 text-xs font-mono">
                                    {(["backend", "frontend"] as const).map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setGhScanType(t)}
                                            className={`px-3 py-1.5 rounded border transition-colors ${ghScanType === t
                                                ? "border-white/40 bg-white/10 text-white"
                                                : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                                                }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Manual tab content */}
                    {tab === "manual" && (
                        <div className="space-y-4 py-2">
                            <div>
                                <label className="block text-xs text-white/50 mb-2">Source Type</label>
                                <div className="flex gap-1 text-xs font-mono">
                                    {(["backend-static", "frontend-static", "runtime-observed"] as SchemaSource[]).map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setSource(s)}
                                            className={`px-3 py-1.5 rounded border transition-colors ${source === s
                                                ? "border-white/40 bg-white/10 text-white"
                                                : "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                                                }`}
                                        >
                                            {s.replace("-static", "").replace("-observed", "")}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-white/50 mb-2">Schema JSON</label>
                                <Textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    placeholder={JSON.stringify(exampleSchema, null, 2)}
                                    className="font-mono text-xs min-h-[200px]"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 p-2 border border-red-500/30 rounded text-sm text-red-400">
                            <X className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={
                            isScanTab ? handleScanSubmit
                            : isGitHubTab ? handleGitHubSubmit
                            : handleManualSubmit
                        }
                        disabled={
                            isScanTab ? !canSubmitScan
                            : isGitHubTab ? !canSubmitGitHub
                            : !jsonInput
                        }
                    >
                        {isScanTab || isGitHubTab ? "Run Analysis" : "Upload"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
