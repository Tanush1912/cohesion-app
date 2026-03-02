"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Save, Check, Key, Eye, EyeOff, Loader2, Github, ExternalLink, Trash2, ChevronDown, ChevronRight, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface GitHubInstallation {
    id: string;
    installation_id: number;
    github_account_login: string;
    github_account_type: string;
    created_at: string;
}

export default function SettingsPage() {
    return (
        <Suspense>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [llmApiKey, setLlmApiKey] = useState("");
    const [llmModel, setLlmModel] = useState("");
    const [githubToken, setGithubToken] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [showGithubToken, setShowGithubToken] = useState(false);

    const [ghAppConfigured, setGhAppConfigured] = useState(false);
    const [ghInstallUrl, setGhInstallUrl] = useState("");
    const [ghInstallations, setGhInstallations] = useState<GitHubInstallation[]>([]);
    const [showPat, setShowPat] = useState(false);

    const loadInstallations = useCallback(async () => {
        try {
            const installations = await api.github.listInstallations();
            setGhInstallations(installations);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        api.userSettings.get()
            .then((settings) => {
                if (settings.gemini_api_key) setLlmApiKey(settings.gemini_api_key);
                if (settings.gemini_model) setLlmModel(settings.gemini_model);
                if (settings.github_token) setGithubToken(settings.github_token);
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        api.github.status()
            .then((status) => {
                setGhAppConfigured(status.configured);
                if (status.install_url) setGhInstallUrl(status.install_url);
            })
            .catch(() => {});

        loadInstallations();
    }, [loadInstallations]);

    useEffect(() => {
        const installationId = searchParams.get("installation_id");
        const setupAction = searchParams.get("setup_action");

        if (installationId && setupAction === "install") {
            const id = parseInt(installationId, 10);
            if (!isNaN(id)) {
                api.github.saveInstallation(id)
                    .then((res) => {
                        toast.success("GitHub account connected", {
                            description: `Connected ${res.github_account_login}`,
                        });
                        loadInstallations();
                    })
                    .catch((e) => {
                        toast.error("Failed to save GitHub installation", {
                            description: (e as Error).message,
                        });
                    });
            }

            const url = new URL(window.location.href);
            url.searchParams.delete("installation_id");
            url.searchParams.delete("setup_action");
            window.history.replaceState({}, "", url.pathname + url.search);
        }
    }, [searchParams, loadInstallations]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.userSettings.save(llmApiKey, llmModel, githubToken);
            toast.success("Settings saved");
        } catch (e) {
            toast.error("Failed to save settings", {
                description: (e as Error).message,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async (installationId: number) => {
        try {
            await api.github.removeInstallation(installationId);
            setGhInstallations((prev) => prev.filter((i) => i.installation_id !== installationId));
            toast.success("GitHub account disconnected");
        } catch (e) {
            toast.error("Failed to disconnect", {
                description: (e as Error).message,
            });
        }
    };

    return (
        <div className="min-h-screen">
            <Header
                title="Settings"
                description="Configure Cohesion"
            />

            <div className="p-6 max-w-2xl">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-6"
                >
                    <Card className="p-4">
                        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <Key className="w-4 h-4" />
                            LLM Configuration
                        </h3>

                        {loading ? (
                            <div className="flex items-center gap-2 py-4 text-xs text-white/40">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Loading settings...
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-white/50 mb-2">API Key</label>
                                    <div className="relative">
                                        <Input
                                            type={showApiKey ? "text" : "password"}
                                            value={llmApiKey}
                                            onChange={(e) => setLlmApiKey(e.target.value)}
                                            placeholder="Enter your Gemini API key"
                                            className="pr-9"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-2.5 top-2.5 text-white/30 hover:text-white/60 transition-colors"
                                        >
                                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-white/30 mt-1.5">
                                        Get a key from{" "}
                                        <a
                                            href="https://aistudio.google.com/apikey"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline"
                                        >
                                            Google AI Studio
                                        </a>
                                        . Encrypted and stored on our server.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs text-white/50 mb-2">Model Name</label>
                                    <Input
                                        value={llmModel}
                                        onChange={(e) => setLlmModel(e.target.value)}
                                        placeholder="gemini-2.5-flash"
                                    />
                                    <p className="text-[10px] text-white/30 mt-1.5">
                                        Leave blank to use the default model.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/50">Status:</span>
                                    {llmApiKey ? (
                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            Configured
                                        </span>
                                    ) : (
                                        <span className="text-xs text-white/40">Not configured</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card className="p-4">
                        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                            <Github className="w-4 h-4" />
                            GitHub Integration
                        </h3>

                        {loading ? (
                            <div className="flex items-center gap-2 py-4 text-xs text-white/40">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Loading settings...
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* GitHub App section */}
                                {ghAppConfigured && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs text-white/50">GitHub App</label>
                                            <a
                                                href={ghInstallUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-white/20 bg-white/5 text-white hover:bg-white/10 transition-colors"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Connect Account
                                            </a>
                                        </div>

                                        {ghInstallations.length > 0 ? (
                                            <div className="space-y-2">
                                                {ghInstallations.map((inst) => (
                                                    <div
                                                        key={inst.id}
                                                        className="flex items-center justify-between p-2.5 rounded-md border border-white/10 bg-white/[0.03]"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {inst.github_account_type === "Organization" ? (
                                                                <Building2 className="w-4 h-4 text-white/40" />
                                                            ) : (
                                                                <User className="w-4 h-4 text-white/40" />
                                                            )}
                                                            <span className="text-sm text-white font-mono">
                                                                {inst.github_account_login}
                                                            </span>
                                                            <span className="text-[10px] text-white/30 capitalize">
                                                                {inst.github_account_type}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDisconnect(inst.installation_id)}
                                                            className="text-white/30 hover:text-red-400 transition-colors p-1"
                                                            title="Disconnect"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-white/30">
                                                No accounts connected yet. Click &quot;Connect Account&quot; to install the Cohesion GitHub App.
                                            </p>
                                        )}

                                        {/* Divider before PAT */}
                                        <button
                                            type="button"
                                            onClick={() => setShowPat(!showPat)}
                                            className="flex items-center gap-2 w-full py-2 text-[10px] text-white/30 hover:text-white/50 transition-colors"
                                        >
                                            {showPat ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                            <span className="uppercase tracking-wider">Personal Access Token (Advanced)</span>
                                            <div className="flex-1 h-px bg-white/10" />
                                        </button>
                                    </div>
                                )}

                                {/* PAT section — shown always if App not configured, collapsible if it is */}
                                {(!ghAppConfigured || showPat) && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs text-white/50 mb-2">Personal Access Token</label>
                                            <div className="relative">
                                                <Input
                                                    type={showGithubToken ? "text" : "password"}
                                                    value={githubToken}
                                                    onChange={(e) => setGithubToken(e.target.value)}
                                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                                    className="pr-9"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowGithubToken(!showGithubToken)}
                                                    className="absolute right-2.5 top-2.5 text-white/30 hover:text-white/60 transition-colors"
                                                >
                                                    {showGithubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-white/30 mt-1.5">
                                                Create a{" "}
                                                <a
                                                    href="https://github.com/settings/tokens/new?scopes=repo&description=Cohesion"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:underline"
                                                >
                                                    Personal Access Token
                                                </a>
                                                {" "}with <code className="text-white/50">repo</code> scope to scan private repositories.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-white/50">Status:</span>
                                            {githubToken ? (
                                                <span className="text-xs text-green-400 flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    Configured
                                                </span>
                                            ) : (
                                                <span className="text-xs text-white/40">Not configured</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Status when App configured and accounts connected and PAT collapsed */}
                                {ghAppConfigured && !showPat && ghInstallations.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-white/50">Status:</span>
                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            {ghInstallations.length} account{ghInstallations.length !== 1 ? "s" : ""} connected
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving || loading}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-3 h-3" />
                                    Save Settings
                                </>
                            )}
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
