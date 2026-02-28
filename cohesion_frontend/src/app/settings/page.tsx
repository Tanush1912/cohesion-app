"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Check, Key, Eye, EyeOff, Loader2, Github } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export default function SettingsPage() {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [llmApiKey, setLlmApiKey] = useState("");
    const [llmModel, setLlmModel] = useState("");
    const [githubToken, setGithubToken] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [showGithubToken, setShowGithubToken] = useState(false);

    useEffect(() => {
        api.userSettings.get()
            .then((settings) => {
                if (settings.gemini_api_key) setLlmApiKey(settings.gemini_api_key);
                if (settings.gemini_model) setLlmModel(settings.gemini_model);
                if (settings.github_token) setGithubToken(settings.github_token);
            })
            .catch(() => {
            })
            .finally(() => setLoading(false));
    }, []);

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
