"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
    FolderUp,
    GitCompareArrows,
    Handshake,
    Radio,
    ArrowRight,
    ArrowRightLeft,
    Copy,
    Check,
    Terminal,
    FileCode2,
    Braces,
    Server,
    Monitor,
    Zap,
    Info,
    Columns2,
    Link2,
    AlignLeft,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


const tabs = [
    { id: "import", label: "Import Codebase", icon: FolderUp },
    { id: "schemas", label: "Schemas & Handshake", icon: Handshake },
    { id: "diff", label: "Diff Engine", icon: GitCompareArrows },
    { id: "live", label: "Live Capture", icon: Radio },
    { id: "dual", label: "Dual Sources", icon: Columns2 },
    { id: "livediff", label: "Live Diff", icon: ArrowRightLeft },
] as const;

type TabId = (typeof tabs)[number]["id"];


function CodeBlock({ code, language, filename }: { code: string; language?: string; filename?: string }) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-lg border border-[var(--border)] bg-[oklch(0.10_0.005_260)] overflow-hidden">
            {(filename || language) && (
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[oklch(0.12_0.005_260)]">
                    <div className="flex items-center gap-2">
                        <FileCode2 className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-xs font-mono text-white/50">
                            {filename || language}
                        </span>
                    </div>
                    <button
                        onClick={copy}
                        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
            )}
            <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono text-white/80">
                <code>{code}</code>
            </pre>
        </div>
    );
}


function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function DocCard({ title, children, icon, id: explicitId }: { title: string; children: React.ReactNode; icon?: React.ReactNode; id?: string }) {
    const sectionId = explicitId || slugify(title);
    return (
        <div id={sectionId} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 scroll-mt-24">
            <div className="flex items-center gap-2.5 mb-3">
                {icon && <div className="text-white/40">{icon}</div>}
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <div className="text-sm text-white/60 leading-relaxed space-y-3">{children}</div>
        </div>
    );
}

function DocSection({ id, title, icon, children }: { id: string; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div id={id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden scroll-mt-24">
            <div className="p-5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5 mb-1">
                    {icon && <div className="text-white/40">{icon}</div>}
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                </div>
            </div>
            {children}
        </div>
    );
}


function Step({ n, title, children, id }: { n: number; title: string; children: React.ReactNode; id?: string }) {
    return (
        <div id={id} className={cn("flex gap-4", id && "scroll-mt-24")}>
            <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full border border-white/20 bg-white/5 flex items-center justify-center text-xs font-mono font-bold text-white/70 shrink-0">
                    {n}
                </div>
                <div className="flex-1 w-px bg-white/10 mt-2" />
            </div>
            <div className="pb-8">
                <h4 className="text-sm font-semibold text-white mb-2">{title}</h4>
                <div className="text-sm text-white/55 leading-relaxed space-y-3">{children}</div>
            </div>
        </div>
    );
}


function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <code className="px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-xs font-mono text-white/70">
            {children}
        </code>
    );
}

interface TocEntry {
    id: string;
    label: string;
    depth: number; // 0 = top-level, 1 = child, 2 = grandchild
}

const tocByTab: Record<TabId, TocEntry[]> = {
    import: [
        { id: "getting-started", label: "Getting started", depth: 0 },
        { id: "step-1", label: "Create a project", depth: 1 },
        { id: "step-2", label: "Open the Upload dialog", depth: 1 },
        { id: "step-3", label: "Choose your source", depth: 1 },
        { id: "step-4", label: "Run the analysis", depth: 1 },
        { id: "manual-upload--schemair-format", label: "Manual Upload: SchemaIR format", depth: 0 },
        { id: "api-reference", label: "API reference", depth: 0 },
    ],
    schemas: [
        { id: "schema-sources", label: "Schema sources", depth: 0 },
        { id: "view-modes", label: "View modes", depth: 0 },
        { id: "the-handshake-view", label: "The Handshake View", depth: 0 },
    ],
    diff: [
        { id: "how-it-works", label: "How it works", depth: 0 },
        { id: "mismatch-types", label: "Mismatch types", depth: 0 },
        { id: "directional-awareness", label: "Directional awareness", depth: 0 },
        { id: "api-reference", label: "API reference", depth: 0 },
    ],
    live: [
        { id: "quick-start--self-capture", label: "Quick start: self-capture", depth: 0 },
        { id: "integrate-with-your-app", label: "Integrate with your app", depth: 0 },
        { id: "node-js", label: "Node.js", depth: 1 },
        { id: "python", label: "Python", depth: 1 },
        { id: "go", label: "Go", depth: 1 },
        { id: "real-time-streaming--sse-", label: "Real-time streaming (SSE)", depth: 0 },
        { id: "ingest-api-reference", label: "Ingest API reference", depth: 0 },
    ],
    dual: [
        { id: "what-is-a-source-", label: "What is a source?", depth: 0 },
        { id: "setting-up-proxy-sources", label: "Setting up proxy sources", depth: 0 },
        { id: "using-the-dual-view", label: "Using the dual view", depth: 0 },
        { id: "api-reference", label: "API reference", depth: 0 },
    ],
    livediff: [
        { id: "how-live-diff-works", label: "How Live Diff works", depth: 0 },
        { id: "when-to-use-live-diff", label: "When to use Live Diff", depth: 0 },
        { id: "quick-start", label: "Quick start", depth: 0 },
        { id: "api-reference", label: "API reference", depth: 0 },
    ],
};

function TableOfContents({ entries }: { entries: TocEntry[] }) {
    const [activeId, setActiveId] = useState<string>("");
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current?.disconnect();

        const ids = entries.map((e) => e.id);
        const visibleSet = new Set<string>();

        observerRef.current = new IntersectionObserver(
            (ioEntries) => {
                for (const entry of ioEntries) {
                    if (entry.isIntersecting) {
                        visibleSet.add(entry.target.id);
                    } else {
                        visibleSet.delete(entry.target.id);
                    }
                }
                // Pick the first visible section in document order
                for (const id of ids) {
                    if (visibleSet.has(id)) {
                        setActiveId(id);
                        return;
                    }
                }
            },
            { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
        );

        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) observerRef.current.observe(el);
        }

        return () => observerRef.current?.disconnect();
    }, [entries]);

    const handleClick = useCallback((id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveId(id);
        }
    }, []);

    if (entries.length === 0) return null;

    return (
        <nav className="w-52 shrink-0 hidden lg:block">
            <div className="sticky top-24">
                <div className="flex items-center gap-2 mb-3">
                    <AlignLeft className="w-3.5 h-3.5 text-white/30" />
                    <span className="text-xs font-medium text-white/50">On this page</span>
                </div>
                <ul className="space-y-0.5 border-l border-white/[0.06]">
                    {entries.map((entry) => {
                        const isActive = activeId === entry.id;
                        return (
                            <li key={entry.id}>
                                <button
                                    onClick={() => handleClick(entry.id)}
                                    className={cn(
                                        "block w-full text-left text-[12px] leading-relaxed py-1 transition-colors border-l-2 -ml-px",
                                        entry.depth === 0 && "pl-3",
                                        entry.depth === 1 && "pl-6",
                                        entry.depth === 2 && "pl-9",
                                        isActive
                                            ? "border-[oklch(0.75_0.15_180)] text-[oklch(0.75_0.15_180)]"
                                            : "border-transparent text-white/35 hover:text-white/60"
                                    )}
                                >
                                    {entry.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </nav>
    );
}

function ImportTab() {
    return (
        <div className="space-y-6">
            <p className="text-sm text-white/50">
                Cohesion extracts API schemas from your codebase using static analysis. You can scan a backend to discover served endpoints, scan a frontend to discover API calls, or upload schemas manually.
            </p>

            <div id="getting-started" className="scroll-mt-24">
                <Step n={1} title="Create a project" id="step-1">
                    <p>From the Dashboard, click <Kbd>New Project</Kbd>. Give it a name and optional description. This is the container for all your endpoints and schemas.</p>
                </Step>

                <Step n={2} title="Open the Upload dialog" id="step-2">
                    <p>Navigate into your project page and click the <Kbd>Upload</Kbd> button in the header. You&apos;ll see three tabs:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                        <div className="rounded border border-[var(--border)] bg-white/3 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Server className="w-3.5 h-3.5 text-[var(--backend)]" />
                                <span className="text-xs font-semibold text-white/70">Scan Backend</span>
                            </div>
                            <p className="text-xs text-white/40">Analyze your server code to extract endpoint definitions</p>
                        </div>
                        <div className="rounded border border-[var(--border)] bg-white/3 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Monitor className="w-3.5 h-3.5 text-[var(--frontend)]" />
                                <span className="text-xs font-semibold text-white/70">Scan Frontend</span>
                            </div>
                            <p className="text-xs text-white/40">Analyze your client code to extract API calls made</p>
                        </div>
                        <div className="rounded border border-[var(--border)] bg-white/3 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Braces className="w-3.5 h-3.5 text-white/50" />
                                <span className="text-xs font-semibold text-white/70">Manual JSON</span>
                            </div>
                            <p className="text-xs text-white/40">Paste SchemaIR JSON directly for full control</p>
                        </div>
                    </div>
                </Step>

                <Step n={3} title="Choose your source" id="step-3">
                    <p>For <strong className="text-white/80">Scan Backend</strong> or <strong className="text-white/80">Scan Frontend</strong>, either:</p>
                    <ul className="list-disc list-inside space-y-1 text-white/50 ml-1">
                        <li>Use the <strong className="text-white/70">folder picker</strong> to select your codebase directory from the browser</li>
                        <li>Enter a <strong className="text-white/70">directory path</strong> that the Cohesion backend can read on disk</li>
                    </ul>
                    <p className="mt-2">Supported file types: <Kbd>.go</Kbd> <Kbd>.py</Kbd> <Kbd>.ts</Kbd> <Kbd>.tsx</Kbd> <Kbd>.js</Kbd> <Kbd>.jsx</Kbd> <Kbd>.java</Kbd> <Kbd>.rb</Kbd> <Kbd>.rs</Kbd> <Kbd>.php</Kbd></p>
                </Step>

                <Step n={4} title="Run the analysis" id="step-4">
                    <p>Click <Kbd>Run Analysis</Kbd>. The backend uses AI-powered static analysis to extract endpoints, request/response shapes, and field types. Results appear as endpoints in your project.</p>
                </Step>
            </div>

            {/* Manual upload example */}
            <DocCard title="Manual Upload: SchemaIR format" icon={<Braces className="w-4 h-4" />}>
                <p>If you prefer to upload schemas directly, use the SchemaIR JSON format:</p>
                <CodeBlock
                    filename="schema.json"
                    code={`{
  "endpoint": "/api/users",
  "method": "POST",
  "source": "backend-static",
  "request": {
    "type": "object",
    "fields": {
      "email": { "type": "string", "required": true },
      "name":  { "type": "string", "required": true },
      "role":  { "type": "string", "required": false }
    }
  },
  "response": {
    "201": {
      "type": "object",
      "fields": {
        "id":    { "type": "string", "required": true },
        "email": { "type": "string", "required": true },
        "name":  { "type": "string", "required": true }
      }
    }
  }
}`}
                />
            </DocCard>

            <DocCard title="API reference" icon={<Terminal className="w-4 h-4" />}>
                <p>Scan a codebase programmatically:</p>
                <CodeBlock
                    filename="scan-backend.sh"
                    code={`curl -X POST http://localhost:8080/api/analyze/scan \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "YOUR_PROJECT_ID",
    "scan_type": "backend",
    "dir_path": "/path/to/your/backend"
  }'`}
                />
                <p className="mt-2">Upload schemas directly:</p>
                <CodeBlock
                    filename="upload-schemas.sh"
                    code={`curl -X POST http://localhost:8080/api/analyze/backend \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "YOUR_PROJECT_ID",
    "schemas": [
      {
        "endpoint": "/api/users",
        "method": "GET",
        "response": {
          "200": {
            "type": "array",
            "items": {
              "type": "object",
              "fields": {
                "id":   { "type": "string", "required": true },
                "name": { "type": "string", "required": true }
              }
            }
          }
        }
      }
    ]
  }'`}
                />
            </DocCard>
        </div>
    );
}

function SchemasTab() {
    return (
        <div className="space-y-6">
            <p className="text-sm text-white/50">
                Once you have at least one schema source uploaded, Cohesion lets you visualize the contract between your frontend and backend through multiple views.
            </p>

            {/* Sources explanation */}
            <DocCard title="Schema sources" icon={<Braces className="w-4 h-4" />}>
                <p>Each endpoint can have up to three schema sources:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                    <div className="rounded border border-[var(--backend)]/30 bg-[var(--backend)]/5 p-3">
                        <Badge variant="source" className="source-backend mb-2">BE</Badge>
                        <p className="text-xs text-white/50 mt-1"><strong className="text-white/70">Backend Static</strong> &mdash; extracted from your server code. Represents what the backend serves and expects.</p>
                    </div>
                    <div className="rounded border border-[var(--frontend)]/30 bg-[var(--frontend)]/5 p-3">
                        <Badge variant="source" className="source-frontend mb-2">FE</Badge>
                        <p className="text-xs text-white/50 mt-1"><strong className="text-white/70">Frontend Static</strong> &mdash; extracted from your client code. Represents what the frontend sends and expects to receive.</p>
                    </div>
                    <div className="rounded border border-[var(--runtime)]/30 bg-[var(--runtime)]/5 p-3">
                        <Badge variant="source" className="source-runtime mb-2">RT</Badge>
                        <p className="text-xs text-white/50 mt-1"><strong className="text-white/70">Runtime Observed</strong> &mdash; inferred from live traffic. Represents what actually happens at runtime.</p>
                    </div>
                </div>
            </DocCard>

            {/* View modes */}
            <DocCard title="View modes">
                <p>On any endpoint detail page, you can switch between three visualization modes:</p>
                <div className="space-y-3 mt-2">
                    <div className="flex gap-3 items-start">
                        <Kbd>flow</Kbd>
                        <p>Interactive React Flow graph showing how request and response fields connect across sources. Pan, zoom, and hover over fields.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                        <Kbd>list</Kbd>
                        <p>Structured tree view of request body and response body fields, organized by section.</p>
                    </div>
                    <div className="flex gap-3 items-start">
                        <Kbd>code</Kbd>
                        <p>Raw JSON view of the full SchemaIR object for the selected source.</p>
                    </div>
                </div>
            </DocCard>

            {/* Handshake */}
            <div id="the-handshake-view" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden scroll-mt-24">
                <div className="p-5 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5 mb-1">
                        <Handshake className="w-4 h-4 text-white/40" />
                        <h3 className="text-sm font-semibold text-white">The Handshake View</h3>
                    </div>
                    <p className="text-sm text-white/50 mt-1">The handshake view is Cohesion&apos;s signature visualization. It shows the contract negotiation between frontend and backend.</p>
                </div>
                <div className="p-5 space-y-4">
                    {/* Three column diagram */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-lg border border-[var(--frontend)]/30 bg-[var(--frontend)]/5 p-4">
                            <Monitor className="w-5 h-5 text-[var(--frontend)] mx-auto mb-2" />
                            <p className="text-xs font-semibold text-white/70">Frontend Intent</p>
                            <p className="text-[11px] text-white/40 mt-1">What the frontend sends &amp; expects</p>
                        </div>
                        <div className="rounded-lg border border-white/20 bg-white/5 p-4">
                            <Handshake className="w-5 h-5 text-white/60 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-white/70">The Agreement</p>
                            <p className="text-[11px] text-white/40 mt-1">Fields both sides agree on</p>
                        </div>
                        <div className="rounded-lg border border-[var(--backend)]/30 bg-[var(--backend)]/5 p-4">
                            <Server className="w-5 h-5 text-[var(--backend)] mx-auto mb-2" />
                            <p className="text-xs font-semibold text-white/70">Backend Capability</p>
                            <p className="text-[11px] text-white/40 mt-1">What the backend serves &amp; accepts</p>
                        </div>
                    </div>

                    <div className="text-sm text-white/55 space-y-2">
                        <p>Each field card shows a colored status dot:</p>
                        <div className="flex flex-wrap gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                                <span className="text-white/50">Match &mdash; both sides agree</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                                <span className="text-white/50">Warning &mdash; optionality difference</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
                                <span className="text-white/50">Missing or type mismatch</span>
                            </span>
                        </div>
                        <p className="mt-3">To use the handshake view, navigate to an endpoint that has at least a <Badge variant="source" className="source-backend">BE</Badge> and <Badge variant="source" className="source-frontend">FE</Badge> source, then click the <Kbd>HANDSHAKE</Kbd> tab.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DiffTab() {
    return (
        <div className="space-y-6">
            <p className="text-sm text-white/50">
                The diff engine compares schemas across all available sources for an endpoint and identifies mismatches in field presence, types, and optionality.
            </p>

            <DocCard title="How it works">
                <Step n={1} title="Upload at least two sources">
                    <p>For a diff to run, an endpoint needs schemas from two or more sources (e.g. backend + frontend, or backend + runtime).</p>
                </Step>
                <Step n={2} title="Navigate to the endpoint">
                    <p>Open the project, then click on an endpoint row. The diff runs automatically on page load.</p>
                </Step>
                <Step n={3} title="Read the Analysis panel">
                    <p>The right-side panel shows the overall status and lists every mismatch found with its severity, description, and suggestion.</p>
                </Step>
            </DocCard>

            {/* Mismatch types */}
            <DocCard title="Mismatch types" icon={<GitCompareArrows className="w-4 h-4" />}>
                <div className="space-y-3">
                    <div className="rounded border border-[var(--error)]/30 bg-[var(--error)]/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="status" status="violation">critical</Badge>
                            <span className="text-xs font-semibold text-white/70">Type Mismatch</span>
                        </div>
                        <p className="text-xs text-white/45">A field has different types across sources, e.g. backend says <Kbd>string</Kbd> but frontend expects <Kbd>number</Kbd>.</p>
                    </div>
                    <div className="rounded border border-[var(--error)]/30 bg-[var(--error)]/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="status" status="violation">critical</Badge>
                            <span className="text-xs font-semibold text-white/70">Missing (FE expects, BE missing)</span>
                        </div>
                        <p className="text-xs text-white/45">Frontend expects a response field the backend doesn&apos;t return. This will break at runtime.</p>
                    </div>
                    <div className="rounded border border-[var(--warning)]/30 bg-[var(--warning)]/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="status" status="partial">warning</Badge>
                            <span className="text-xs font-semibold text-white/70">Optionality Mismatch</span>
                        </div>
                        <p className="text-xs text-white/45">A field is required in one source but optional in another. May cause issues with strict validation.</p>
                    </div>
                    <div className="rounded border border-white/10 bg-white/3 p-3">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge>info</Badge>
                            <span className="text-xs font-semibold text-white/70">Extra Field</span>
                        </div>
                        <p className="text-xs text-white/45">Backend returns extra fields the frontend ignores, or frontend sends extra fields the backend ignores. Harmless but worth knowing.</p>
                    </div>
                </div>
            </DocCard>

            {/* Directional awareness */}
            <DocCard title="Directional awareness">
                <p>The diff engine understands which direction data flows:</p>
                <div className="space-y-3 mt-2">
                    <div className="flex items-start gap-3">
                        <ArrowRight className="w-4 h-4 text-[var(--frontend)] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-white/70">Request fields (FE <ArrowRight className="w-3 h-3 inline" /> BE)</p>
                            <p className="text-xs text-white/45">Frontend sends data to backend. If backend expects a field the frontend doesn&apos;t send, it&apos;s a warning. If frontend sends extra fields, it&apos;s info-only.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <ArrowRight className="w-4 h-4 text-[var(--backend)] shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-white/70">Response fields (BE <ArrowRight className="w-3 h-3 inline" /> FE)</p>
                            <p className="text-xs text-white/45">Backend returns data to frontend. If frontend expects a field the backend doesn&apos;t return, it&apos;s critical. Extra backend fields are info-only.</p>
                        </div>
                    </div>
                </div>
            </DocCard>

            <DocCard title="API reference" icon={<Terminal className="w-4 h-4" />}>
                <p>Compute a diff programmatically:</p>
                <CodeBlock
                    filename="compute-diff.sh"
                    code={`curl http://localhost:8080/api/diff/ENDPOINT_ID`}
                />
                <p className="mt-2">Response:</p>
                <CodeBlock
                    filename="diff-result.json"
                    code={`{
  "endpoint": "/api/users",
  "method": "POST",
  "sources_compared": ["backend-static", "frontend-static"],
  "status": "partial",
  "mismatches": [
    {
      "path": "response.200.role",
      "type": "missing",
      "description": "Field missing in: [frontend-static]",
      "in_sources": ["backend-static"],
      "severity": "info",
      "suggestion": "Extra field — safe to ignore"
    }
  ]
}`}
                />
            </DocCard>
        </div>
    );
}

function LiveTab() {
    return (
        <div className="space-y-6">
            <div className="flex items-start gap-3 rounded-lg border border-blue-400/20 bg-blue-400/5 px-4 py-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-200/80">
                    <strong className="text-blue-300">Local only.</strong> Live Capture records HTTP traffic on your local machine. It will not capture traffic from deployed or remote environments.
                </div>
            </div>

            <p className="text-sm text-white/50">
                Live Capture lets you observe real HTTP traffic flowing through your application, then infer runtime schemas from it. This gives you a third source of truth alongside static analysis.
            </p>

            <DocCard title="Quick start: self-capture">
                <p>The fastest way to try Live Capture is <strong className="text-white/70">self-capture mode</strong>, which records Cohesion&apos;s own API traffic:</p>
                <Step n={1} title="Open the Live page">
                    <p>Click <Kbd>Live</Kbd> in the sidebar.</p>
                </Step>
                <Step n={2} title="Select a project">
                    <p>Pick the project you want to associate captured traffic with.</p>
                </Step>
                <Step n={3} title="Start capture">
                    <p>Click <Kbd>Start Capture</Kbd>. You&apos;ll see a green pulsing indicator showing the system is listening.</p>
                </Step>
                <Step n={4} title="Generate traffic">
                    <p>Use the Cohesion UI normally &mdash; browse projects, view endpoints, compute diffs. Each API call will appear in the live feed in real time.</p>
                </Step>
                <Step n={5} title="Infer schemas">
                    <p>Click <Kbd>Infer Schema</Kbd> to convert captured requests into runtime-observed schemas. These become the <Badge variant="source" className="source-runtime">RT</Badge> source for your endpoints.</p>
                </Step>
            </DocCard>

            {/* Integration guide */}
            <div id="integrate-with-your-app" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden scroll-mt-24">
                <div className="p-5 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5 mb-1">
                        <Zap className="w-4 h-4 text-white/40" />
                        <h3 className="text-sm font-semibold text-white">Integrate with your app</h3>
                    </div>
                    <p className="text-sm text-white/50 mt-1">Add a middleware to your application to send live traffic to Cohesion. This works with any HTTP framework.</p>
                </div>
                <div className="p-5 space-y-5">
                    <div id="node-js" className="scroll-mt-24">
                        <div className="flex items-center gap-2 mb-3">
                            <Badge method="POST" variant="method">Node.js</Badge>
                            <span className="text-xs text-white/40">Express middleware</span>
                        </div>
                        <CodeBlock
                            filename="cohesion-middleware.ts"
                            code={`import { randomUUID } from "crypto";

const COHESION_URL = "http://localhost:8080";
const PROJECT_ID  = "YOUR_PROJECT_ID";

export function cohesionMiddleware(req, res, next) {
  const start = Date.now();
  const originalJson = res.json.bind(res);
  let responseBody;

  res.json = (data) => {
    responseBody = data;
    return originalJson(data);
  };

  res.on("finish", () => {
    fetch(\`\${COHESION_URL}/api/live/ingest\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: PROJECT_ID,
        requests: [{
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
          status_code: res.statusCode,
          duration_ms: Date.now() - start,
          request_body: req.body ?? null,
          response_body: responseBody ?? null,
        }],
      }),
    }).catch(() => {}); // fire-and-forget
  });

  next();
}

// Usage:
// app.use(cohesionMiddleware);`}
                        />
                    </div>

                    <div id="python" className="scroll-mt-24">
                        <div className="flex items-center gap-2 mb-3">
                            <Badge method="PUT" variant="method">Python</Badge>
                            <span className="text-xs text-white/40">FastAPI middleware</span>
                        </div>
                        <CodeBlock
                            filename="cohesion_middleware.py"
                            code={`import time, uuid, httpx
from starlette.middleware.base import BaseHTTPMiddleware

COHESION_URL = "http://localhost:8080"
PROJECT_ID   = "YOUR_PROJECT_ID"

class CohesionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        body = await request.body()
        response = await call_next(request)

        # Read response body
        resp_body = b""
        async for chunk in response.body_iterator:
            resp_body += chunk

        duration_ms = (time.time() - start) * 1000

        # Fire-and-forget to Cohesion
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{COHESION_URL}/api/live/ingest",
                    json={
                        "project_id": PROJECT_ID,
                        "requests": [{
                            "id": str(uuid.uuid4()),
                            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "path": request.url.path,
                            "method": request.method,
                            "status_code": response.status_code,
                            "duration_ms": round(duration_ms, 1),
                            "request_body": body.decode() or None,
                            "response_body": resp_body.decode() or None,
                        }],
                    },
                )
        except Exception:
            pass

        # Re-create response with consumed body
        from starlette.responses import Response
        return Response(
            content=resp_body,
            status_code=response.status_code,
            headers=dict(response.headers),
        )

# Usage:
# app.add_middleware(CohesionMiddleware)`}
                        />
                    </div>

                    <div id="go" className="scroll-mt-24">
                        <div className="flex items-center gap-2 mb-3">
                            <Badge method="GET" variant="method">Go</Badge>
                            <span className="text-xs text-white/40">net/http middleware</span>
                        </div>
                        <CodeBlock
                            filename="cohesion_middleware.go"
                            code={`package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const cohesionURL = "http://localhost:8080"
const projectID   = "YOUR_PROJECT_ID"

func CohesionCapture(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Read request body
		reqBody, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewReader(reqBody))

		// Wrap response writer to capture status + body
		rec := &recorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)

		// Send to Cohesion (fire-and-forget)
		go func() {
			payload, _ := json.Marshal(map[string]any{
				"project_id": projectID,
				"requests": []map[string]any{{
					"id":            uuid.New().String(),
					"timestamp":     start.UTC().Format(time.RFC3339),
					"path":          r.URL.Path,
					"method":        r.Method,
					"status_code":   rec.status,
					"duration_ms":   time.Since(start).Milliseconds(),
					"request_body":  json.RawMessage(reqBody),
					"response_body": json.RawMessage(rec.body.Bytes()),
				}},
			})
			http.Post(cohesionURL+"/api/live/ingest",
				"application/json", bytes.NewReader(payload))
		}()
	})
}

type recorder struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (r *recorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *recorder) Write(b []byte) (int, error) {
	r.body.Write(b)
	return r.ResponseWriter.Write(b)
}

// Usage:
// mux.Use(middleware.CohesionCapture)`}
                        />
                    </div>
                </div>
            </div>

            {/* SSE streaming */}
            <DocCard title="Real-time streaming (SSE)" icon={<Radio className="w-4 h-4" />}>
                <p>The Live page uses Server-Sent Events for real-time updates. You can also subscribe programmatically:</p>
                <CodeBlock
                    filename="subscribe.ts"
                    code={`const es = new EventSource(
  "http://localhost:8080/api/live/stream?project_id=YOUR_PROJECT_ID"
);

es.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "request") {
    console.log("New request:", data.payload);
    // { id, timestamp, path, method, status_code, duration_ms, ... }
  }

  if (data.type === "clear") {
    console.log("Buffer cleared");
  }
};`}
                />
            </DocCard>

            <DocCard title="Ingest API reference" icon={<Terminal className="w-4 h-4" />}>
                <CodeBlock
                    filename="ingest.sh"
                    code={`# Send captured requests
curl -X POST http://localhost:8080/api/live/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "YOUR_PROJECT_ID",
    "requests": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "timestamp": "2025-01-15T10:30:00Z",
        "path": "/api/users",
        "method": "GET",
        "status_code": 200,
        "duration_ms": 45,
        "response_body": {
          "users": [{ "id": "1", "name": "Alice" }]
        }
      }
    ]
  }'

# Infer schemas from captured traffic
curl -X POST http://localhost:8080/api/live/infer \\
  -H "Content-Type: application/json" \\
  -d '{ "project_id": "YOUR_PROJECT_ID" }'`}
                />
            </DocCard>
        </div>
    );
}

function DualSourcesTab() {
    return (
        <div className="space-y-6">
            <p className="text-sm text-white/50">
                Dual Sources mode lets you capture live traffic from two different origins side by side. This is useful when you want to compare how two services, environments, or API versions handle the same endpoints in real time.
            </p>

            <DocCard title="What is a source?">
                <p>Every captured request is tagged with a <Kbd>source</Kbd> label that identifies where it came from. By default, self-captured traffic is labelled <Kbd>self</Kbd>. When you set up a reverse proxy, traffic flowing through that proxy is labelled with the name you choose (e.g. <Kbd>staging-api</Kbd>).</p>
                <p>In the Dual Sources view the Live page splits into two columns, one per source, so you can watch traffic arrive from both origins simultaneously.</p>
            </DocCard>

            <DocCard title="Setting up proxy sources" icon={<Link2 className="w-4 h-4" />}>
                <p>A <strong className="text-white/70">proxy source</strong> is a reverse-proxy target hosted by the Cohesion backend. You point it at an external service and Cohesion forwards every request, records the full request/response pair, and tags it with the source label you chose.</p>
                <Step n={1} title="Switch to Dual Sources mode">
                    <p>On the Live page, click the <Kbd>Dual Sources</Kbd> tab. A <strong className="text-white/70">Proxy Sources</strong> configuration panel appears below the tab bar.</p>
                </Step>
                <Step n={2} title="Add a proxy source">
                    <p>Click <Kbd>Add</Kbd>, then fill in:</p>
                    <ul className="list-disc list-inside space-y-1 text-white/50 ml-1">
                        <li><strong className="text-white/70">Label</strong> &mdash; a short name like <Kbd>staging-api</Kbd> or <Kbd>v2</Kbd>. This becomes the source tag on captured requests.</li>
                        <li><strong className="text-white/70">Target URL</strong> &mdash; the base URL of the service to proxy, e.g. <Kbd>http://localhost:3001</Kbd>.</li>
                    </ul>
                    <p className="mt-2">Click <Kbd>Configure</Kbd>. Cohesion registers the proxy and returns a proxy URL you can use in place of the original service.</p>
                </Step>
                <Step n={3} title="Send traffic through the proxy">
                    <p>Copy the proxy URL (click the copy icon next to the source) and point your client at it instead of the original service. For example, if your proxy URL is:</p>
                    <CodeBlock
                        code={`http://localhost:8080/api/live/proxy/PROJECT_ID/staging-api/`}
                    />
                    <p className="mt-2">Then a request to <Kbd>/api/users</Kbd> would be sent to:</p>
                    <CodeBlock
                        code={`http://localhost:8080/api/live/proxy/PROJECT_ID/staging-api/api/users`}
                    />
                    <p className="mt-2">Cohesion forwards the request to your target URL, captures both the request and response, tags the capture with your label, and returns the real response to the caller.</p>
                </Step>
            </DocCard>

            <DocCard title="Using the dual view">
                <p>Once you have traffic from two sources, the Dual Sources view shows them in side-by-side columns. Use the source selectors in the tab bar to pick which two sources to compare.</p>
                <div className="space-y-2 mt-2">
                    <div className="flex gap-3 items-start">
                        <Kbd>Source A</Kbd>
                        <p>The left column. Defaults to <Kbd>self</Kbd> (Cohesion&apos;s own captured traffic).</p>
                    </div>
                    <div className="flex gap-3 items-start">
                        <Kbd>Source B</Kbd>
                        <p>The right column. Auto-selects the first configured proxy source, or you can pick any source that has recorded traffic.</p>
                    </div>
                </div>
                <p className="mt-3">Click any request in either column to view its full request/response detail in the right-hand panel.</p>
            </DocCard>

            <DocCard title="API reference" icon={<Terminal className="w-4 h-4" />}>
                <p>Configure a proxy source programmatically:</p>
                <CodeBlock
                    filename="configure-proxy.sh"
                    code={`curl -X POST http://localhost:8080/api/live/proxy/configure \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "YOUR_PROJECT_ID",
    "label": "staging-api",
    "target_url": "http://localhost:3001"
  }'

# Response:
# { "message": "proxy configured", "proxy_url": "http://localhost:8080/api/live/proxy/PROJECT_ID/staging-api" }`}
                />
                <p className="mt-3">List distinct sources that have recorded traffic:</p>
                <CodeBlock
                    filename="get-sources.sh"
                    code={`curl http://localhost:8080/api/live/sources?project_id=YOUR_PROJECT_ID

# Response:
# ["self", "staging-api"]`}
                />
            </DocCard>
        </div>
    );
}

function LiveDiffTab() {
    return (
        <div className="space-y-6">
            <p className="text-sm text-white/50">
                Live Diff compares the runtime-inferred schemas of two traffic sources. Instead of comparing static code analysis, it compares what two services <em>actually send and receive</em> at runtime, then surfaces every mismatch between them.
            </p>

            <DocCard title="How Live Diff works" icon={<ArrowRightLeft className="w-4 h-4" />}>
                <p>When you click <Kbd>Compute Diff</Kbd>, the backend performs these steps for each source:</p>
                <Step n={1} title="Infer schemas per source">
                    <p>Cohesion groups the buffered requests for each source by <Kbd>method + path</Kbd>, then infers a schema from the observed request and response bodies. Fields seen in every request are marked <strong className="text-white/70">required</strong>; fields seen in only some requests are marked <strong className="text-white/70">optional</strong>.</p>
                </Step>
                <Step n={2} title="Tag and align schemas">
                    <p>The inferred schemas from Source A are tagged as <Kbd>backend-static</Kbd> and from Source B as <Kbd>frontend-static</Kbd>. The diff engine then matches endpoints across both sets by method and path.</p>
                </Step>
                <Step n={3} title="Compute mismatches">
                    <p>For every matched endpoint, the diff engine compares request bodies and response bodies field by field, looking for:</p>
                    <ul className="list-disc list-inside space-y-1 text-white/50 ml-1">
                        <li><strong className="text-white/70">Missing fields</strong> &mdash; present in one source but not the other</li>
                        <li><strong className="text-white/70">Type mismatches</strong> &mdash; same field name, different types</li>
                        <li><strong className="text-white/70">Optionality mismatches</strong> &mdash; required in one source, optional in the other</li>
                        <li><strong className="text-white/70">Extra fields</strong> &mdash; sent by one side, ignored by the other</li>
                    </ul>
                </Step>
                <Step n={4} title="Display results">
                    <p>Results are shown in a two-panel layout: an endpoint list on the left with status icons, and the full mismatch detail on the right using the same diff panel as the static Diff Engine.</p>
                </Step>
            </DocCard>

            <DocCard title="When to use Live Diff">
                <div className="space-y-3">
                    <div className="rounded border border-white/10 bg-white/3 p-3">
                        <p className="text-xs font-semibold text-white/70 mb-1">Comparing environments</p>
                        <p className="text-xs text-white/45">Set up two proxy sources pointing at staging and production. Capture the same API calls through both and diff to find behavioral drift.</p>
                    </div>
                    <div className="rounded border border-white/10 bg-white/3 p-3">
                        <p className="text-xs font-semibold text-white/70 mb-1">Comparing API versions</p>
                        <p className="text-xs text-white/45">Proxy <Kbd>v1</Kbd> and <Kbd>v2</Kbd> of your API. Live Diff will show you exactly which fields changed, were added, or were removed between versions.</p>
                    </div>
                    <div className="rounded border border-white/10 bg-white/3 p-3">
                        <p className="text-xs font-semibold text-white/70 mb-1">Validating a migration</p>
                        <p className="text-xs text-white/45">Route traffic to both the old and new service simultaneously. If Live Diff shows all matches, you can be confident the new service is behaviourally equivalent.</p>
                    </div>
                </div>
            </DocCard>

            <DocCard title="Quick start">
                <Step n={1} title="Set up two sources">
                    <p>You need traffic from at least two distinct sources. The fastest way is to use <Kbd>self</Kbd> capture plus one proxy source (see the <strong className="text-white/70">Dual Sources</strong> docs tab). You can also ingest traffic via the API with different <Kbd>source</Kbd> labels.</p>
                </Step>
                <Step n={2} title="Capture traffic from both">
                    <p>Start capture and generate some requests through each source. Both columns in the Dual Sources view should show traffic.</p>
                </Step>
                <Step n={3} title="Switch to Live Diff">
                    <p>Click the <Kbd>Live Diff</Kbd> tab on the Live page. The source selectors carry over from the Dual Sources view.</p>
                </Step>
                <Step n={4} title="Compute Diff">
                    <p>Click <Kbd>Compute Diff</Kbd>. The header bar shows how many requests each source has. Results appear in the endpoint list on the left.</p>
                </Step>
            </DocCard>

            <DocCard title="API reference" icon={<Terminal className="w-4 h-4" />}>
                <p>Compute a live diff programmatically:</p>
                <CodeBlock
                    filename="live-diff.sh"
                    code={`curl -X POST http://localhost:8080/api/live/diff \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "YOUR_PROJECT_ID",
    "source_a": "self",
    "source_b": "staging-api"
  }'`}
                />
                <p className="mt-2">Response:</p>
                <CodeBlock
                    filename="live-diff-result.json"
                    code={`{
  "source_a": "self",
  "source_b": "staging-api",
  "endpoint_count": 3,
  "results": [
    {
      "endpoint": "/api/users",
      "method": "GET",
      "sources_compared": ["backend-static", "frontend-static"],
      "status": "partial",
      "mismatches": [
        {
          "path": "response.200.avatar_url",
          "type": "missing",
          "description": "Field present in source_a but missing in source_b",
          "in_sources": ["backend-static"],
          "severity": "warning",
          "suggestion": "Verify the field is returned by staging-api"
        }
      ]
    },
    {
      "endpoint": "/api/projects",
      "method": "GET",
      "sources_compared": ["backend-static", "frontend-static"],
      "status": "match",
      "mismatches": []
    }
  ]
}`}
                />
            </DocCard>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function DocsPage() {
    const [activeTab, setActiveTab] = useState<TabId>("import");

    const tabContent: Record<TabId, React.ReactNode> = {
        import: <ImportTab />,
        schemas: <SchemasTab />,
        diff: <DiffTab />,
        live: <LiveTab />,
        dual: <DualSourcesTab />,
        livediff: <LiveDiffTab />,
    };

    return (
        <div className="min-h-screen flex flex-col">
            <Header
                title="Documentation"
                description="Learn how to use Cohesion to inspect your API contracts"
            />

            <div className="flex-1 section-padding">
                {/* Tab bar */}
                <div className="flex items-center gap-1 border-b border-[var(--border)] mb-6">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px",
                                    isActive
                                        ? "border-white text-white font-medium"
                                        : "border-transparent text-white/40 hover:text-white/70"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab content + TOC sidebar */}
                <div className="flex gap-10">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className="max-w-3xl flex-1 min-w-0"
                    >
                        {tabContent[activeTab]}
                    </motion.div>
                    <TableOfContents entries={tocByTab[activeTab]} />
                </div>
            </div>
        </div>
    );
}
