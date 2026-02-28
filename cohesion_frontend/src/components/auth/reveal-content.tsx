"use client";

function MiniFieldCard({
    label,
    type,
    status,
}: {
    label: string;
    type: string;
    status: "match" | "mismatch" | "warning" | "missing";
}) {
    const colors = {
        match: { dot: "bg-emerald-400", border: "border-emerald-500/20", text: "text-white/70" },
        mismatch: { dot: "bg-red-400", border: "border-red-500/30", text: "text-red-400/80" },
        warning: { dot: "bg-amber-400", border: "border-amber-500/30", text: "text-white/70" },
        missing: { dot: "bg-red-400", border: "border-red-500/30", text: "text-red-400/80" },
    };
    const c = colors[status];
    const isBad = status === "mismatch" || status === "missing";
    return (
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${c.border} ${isBad ? "bg-red-500/5" : "bg-white/[0.02]"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
            <span className={`font-mono text-[10px] ${c.text} flex-1`}>{label}</span>
            <span className="font-mono text-[9px] text-white/25">{type}</span>
        </div>
    );
}

function MiniColumnHeader({ label, subtitle, accent }: { label: string; subtitle: string; accent: string }) {
    return (
        <div className="rounded-md border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="h-[2px]" style={{ background: accent }} />
            <div className="px-2.5 py-1.5">
                <div className="font-mono text-[10px] font-semibold text-white/70">{label}</div>
                <div className="font-mono text-[8px] text-white/30">{subtitle}</div>
            </div>
        </div>
    );
}

function FlowLine({ status }: { status: "match" | "mismatch" | "warning" }) {
    const color = status === "match" ? "oklch(0.72 0.19 145 / 40%)" : status === "mismatch" ? "oklch(0.65 0.24 25 / 60%)" : "oklch(0.78 0.16 75 / 50%)";
    return (
        <svg width="28" height="2" className="shrink-0">
            <line x1="0" y1="1" x2="28" y2="1" stroke={color} strokeWidth="1.5" strokeDasharray={status === "match" ? "none" : "4,3"} />
        </svg>
    );
}

function AgreementCard({ label, status }: { label: string; status: "match" | "mismatch" | "missing" }) {
    const isOk = status === "match";
    return (
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${isOk ? "border-emerald-500/20 bg-white/[0.02]" : "border-red-500/30 bg-red-500/5"}`}>
            <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${isOk ? "bg-emerald-400/15 border border-emerald-400/40 text-emerald-400" : "bg-red-400/15 border border-red-400/40 text-red-400"}`}>
                {isOk ? "✓" : "✕"}
            </div>
            <span className={`font-mono text-[10px] ${isOk ? "text-white/70" : "text-red-400/80"}`}>{label}</span>
            {status === "missing" && <span className="text-[8px] font-mono text-red-400 bg-red-500/15 px-1 rounded ml-auto">Missing!</span>}
        </div>
    );
}

export function RevealContent() {
    return (
        <div className="absolute inset-0 overflow-hidden">

            {/* ═══ TOP-LEFT: Mini Handshake Flow ═══ */}
            <div className="absolute top-[6%] left-[3%] opacity-90">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2 font-mono">Handshake View</div>
                <div className="flex items-start gap-1">
                    <div className="space-y-1 w-[120px]">
                        <MiniColumnHeader label="Frontend Intent" subtitle="source fields" accent="oklch(0.75 0.15 320)" />
                        <MiniFieldCard label="id" type="string" status="match" />
                        <MiniFieldCard label="name" type="string" status="match" />
                        <MiniFieldCard label="email" type="string" status="mismatch" />
                        <MiniFieldCard label="avatar" type="string" status="missing" />
                    </div>
                    <div className="flex flex-col gap-1 pt-[34px] items-center">
                        <FlowLine status="match" />
                        <FlowLine status="match" />
                        <FlowLine status="mismatch" />
                        <FlowLine status="mismatch" />
                    </div>
                    <div className="space-y-1 w-[120px]">
                        <MiniColumnHeader label="Agreement" subtitle="consensus" accent="oklch(0.72 0.19 145)" />
                        <AgreementCard label="id" status="match" />
                        <AgreementCard label="name" status="match" />
                        <AgreementCard label="email" status="mismatch" />
                        <AgreementCard label="avatar" status="missing" />
                    </div>
                    <div className="flex flex-col gap-1 pt-[34px] items-center">
                        <FlowLine status="match" />
                        <FlowLine status="match" />
                        <FlowLine status="mismatch" />
                        <FlowLine status="mismatch" />
                    </div>
                    <div className="space-y-1 w-[120px]">
                        <MiniColumnHeader label="Backend" subtitle="provided" accent="oklch(0.70 0.14 230)" />
                        <MiniFieldCard label="id" type="string" status="match" />
                        <MiniFieldCard label="name" type="string" status="match" />
                        <MiniFieldCard label="email" type="number" status="mismatch" />
                    </div>
                </div>
            </div>

            {/* ═══ TOP-RIGHT: Diff Panel ═══ */}
            <div className="absolute top-[5%] right-[3%] w-[250px] opacity-90">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2 font-mono">Compute Diff</div>
                <div className="rounded-lg border border-white/8 bg-white/[0.02] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/8">
                        <span className="text-amber-400 font-mono text-sm">○</span>
                        <span className="text-[11px] font-medium text-white/70">Partial match</span>
                        <span className="text-[9px] text-white/30 ml-auto font-mono"><span className="text-red-400">1 critical</span> · 4 total</span>
                    </div>
                    <div className="divide-y divide-white/5">
                        <div className="px-3 py-1.5">
                            <div className="flex items-start gap-1.5">
                                <span className="text-red-400 font-mono text-[10px] shrink-0">✕</span>
                                <div>
                                    <code className="text-[10px] font-mono text-white/70">response.email</code>
                                    <p className="text-[9px] text-white/30">Type mismatch: expected string, got number</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-3 py-1.5">
                            <div className="flex items-start gap-1.5">
                                <span className="text-red-400 font-mono text-[10px] shrink-0">✕</span>
                                <div>
                                    <code className="text-[10px] font-mono text-white/70">response.avatar</code>
                                    <p className="text-[9px] text-white/30">Missing in backend schema</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-3 py-1.5">
                            <div className="flex items-start gap-1.5">
                                <span className="text-amber-400 font-mono text-[10px] shrink-0">○</span>
                                <div>
                                    <code className="text-[10px] font-mono text-white/70">response.role</code>
                                    <p className="text-[9px] text-white/30">Optional in frontend, required in backend</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-3 py-1.5">
                            <div className="flex items-start gap-1.5">
                                <span className="text-blue-400 font-mono text-[10px] shrink-0">i</span>
                                <div>
                                    <code className="text-[10px] font-mono text-white/70">response.metadata</code>
                                    <p className="text-[9px] text-white/30">Extra field in backend, unused by frontend</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ MID-LEFT: Schema JSON blocks ═══ */}
            <div className="absolute top-[42%] left-[3%] opacity-70">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/25 mb-1.5 font-mono">Frontend Schema</div>
                <pre className="font-mono text-[9px] text-white/35 leading-relaxed">
{`{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "email": { "type": "string" },
    "avatar": { "type": "string" },
    "role": { "type": "string" }
  },
  "required": ["id", "name", "email"]
}`}
                </pre>
            </div>

            {/* ═══ MID-RIGHT: Backend schema ═══ */}
            <div className="absolute top-[44%] right-[3%] opacity-70">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/25 mb-1.5 font-mono text-right">Backend Schema</div>
                <pre className="font-mono text-[9px] text-white/35 leading-relaxed">
{`{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "email": { "type": "number" },
    "role": { "type": "string" },
    "metadata": { "type": "object" }
  },
  "required": ["id", "name", "role"]
}`}
                </pre>
            </div>

            {/* ═══ BOTTOM-LEFT: Endpoints list ═══ */}
            <div className="absolute bottom-[14%] left-[3%] opacity-80">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2 font-mono">Endpoints</div>
                <div className="space-y-1 font-mono text-[10px]">
                    <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-[9px] bg-emerald-400/10 px-1.5 py-0.5 rounded">GET</span>
                        <span className="text-white/45">/api/users</span>
                        <span className="text-emerald-400 text-[8px] ml-1">✓</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-blue-400 text-[9px] bg-blue-400/10 px-1.5 py-0.5 rounded">POST</span>
                        <span className="text-white/45">/api/projects</span>
                        <span className="text-emerald-400 text-[8px] ml-1">✓</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-[9px] bg-amber-400/10 px-1.5 py-0.5 rounded">PUT</span>
                        <span className="text-white/45">/api/users/:id</span>
                        <span className="text-amber-400 text-[8px] ml-1">○</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-rose-400 text-[9px] bg-rose-400/10 px-1.5 py-0.5 rounded">DEL</span>
                        <span className="text-white/45">/api/sessions</span>
                        <span className="text-red-400 text-[8px] ml-1">✕</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-[9px] bg-emerald-400/10 px-1.5 py-0.5 rounded">GET</span>
                        <span className="text-white/45">/api/projects/:id</span>
                        <span className="text-emerald-400 text-[8px] ml-1">✓</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-blue-400 text-[9px] bg-blue-400/10 px-1.5 py-0.5 rounded">POST</span>
                        <span className="text-white/45">/api/auth/login</span>
                        <span className="text-emerald-400 text-[8px] ml-1">✓</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-[9px] bg-amber-400/10 px-1.5 py-0.5 rounded">PATCH</span>
                        <span className="text-white/45">/api/settings</span>
                        <span className="text-amber-400 text-[8px] ml-1">○</span>
                    </div>
                </div>
            </div>

            {/* ═══ BOTTOM-RIGHT: Contract Health + Stats ═══ */}
            <div className="absolute bottom-[14%] right-[3%] w-[200px] opacity-80">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2 font-mono">Contract Health</div>
                <div className="space-y-1.5">
                    <div>
                        <div className="flex justify-between text-[9px] font-mono mb-0.5">
                            <span className="text-white/35">matched</span>
                            <span className="text-emerald-400">8</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full w-[66%] rounded-full bg-emerald-400/60" />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] font-mono mb-0.5">
                            <span className="text-white/35">partial</span>
                            <span className="text-amber-400">3</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full w-[25%] rounded-full bg-amber-400/60" />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] font-mono mb-0.5">
                            <span className="text-white/35">violations</span>
                            <span className="text-red-400">1</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full w-[8%] rounded-full bg-red-400/60" />
                        </div>
                    </div>
                </div>

                {/* Runtime stats */}
                <div className="mt-4 pt-3 border-t border-white/5">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/30 mb-2 font-mono">Runtime</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded border border-white/5 bg-white/[0.02] p-2 text-center">
                            <div className="font-mono text-sm text-white/60">47</div>
                            <div className="font-mono text-[8px] text-white/25">requests</div>
                        </div>
                        <div className="rounded border border-white/5 bg-white/[0.02] p-2 text-center">
                            <div className="font-mono text-sm text-white/60">12</div>
                            <div className="font-mono text-[8px] text-white/25">schemas</div>
                        </div>
                        <div className="rounded border border-white/5 bg-white/[0.02] p-2 text-center">
                            <div className="font-mono text-sm text-white/60">3</div>
                            <div className="font-mono text-[8px] text-white/25">projects</div>
                        </div>
                        <div className="rounded border border-white/5 bg-white/[0.02] p-2 text-center">
                            <div className="font-mono text-sm text-emerald-400/70">0</div>
                            <div className="font-mono text-[8px] text-white/25">regressions</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Scattered small fragments ═══ */}

            {/* Type annotations */}
            <div className="absolute top-[28%] left-[28%] font-mono text-[9px] text-white/20">
                interface User {"{"}<br />
                &nbsp;&nbsp;id: string;<br />
                &nbsp;&nbsp;name: string;<br />
                &nbsp;&nbsp;email: string;<br />
                {"}"}
            </div>

            <div className="absolute top-[18%] left-[52%] font-mono text-[9px] text-white/20">
                type MatchStatus = &quot;match&quot; | &quot;partial&quot; | &quot;violation&quot;
            </div>

            <div className="absolute bottom-[38%] right-[28%] font-mono text-[9px] text-white/20">
                type SchemaSource = &quot;backend-static&quot;<br />
                &nbsp;&nbsp;| &quot;frontend-static&quot;<br />
                &nbsp;&nbsp;| &quot;runtime-observed&quot;
            </div>

            {/* Floating status orbs */}
            <div className="absolute top-[20%] right-[35%] flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400/50" />
                <span className="font-mono text-[8px] text-white/25">match</span>
            </div>
            <div className="absolute top-[24%] right-[32%] flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400/50" />
                <span className="font-mono text-[8px] text-white/25">partial</span>
            </div>
            <div className="absolute top-[28%] right-[34%] flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400/50" />
                <span className="font-mono text-[8px] text-white/25">violation</span>
            </div>

            {/* Connecting dotted lines scattered */}
            <svg className="absolute top-[32%] left-[22%] opacity-20" width="80" height="40">
                <line x1="0" y1="20" x2="80" y2="20" stroke="white" strokeWidth="1" strokeDasharray="3,4" />
                <circle cx="0" cy="20" r="3" fill="oklch(0.72 0.19 145 / 60%)" />
                <circle cx="80" cy="20" r="3" fill="oklch(0.70 0.14 230 / 60%)" />
            </svg>

            <svg className="absolute bottom-[30%] left-[55%] opacity-20" width="60" height="30">
                <line x1="0" y1="15" x2="60" y2="15" stroke="white" strokeWidth="1" strokeDasharray="3,4" />
                <circle cx="0" cy="15" r="3" fill="oklch(0.75 0.15 320 / 60%)" />
                <circle cx="60" cy="15" r="3" fill="oklch(0.72 0.19 145 / 60%)" />
            </svg>

            <svg className="absolute top-[55%] left-[48%] opacity-15" width="100" height="50">
                <path d="M0,25 Q50,0 100,25" stroke="white" strokeWidth="1" strokeDasharray="4,4" fill="none" />
                <circle cx="0" cy="25" r="2.5" fill="oklch(0.70 0.14 230 / 60%)" />
                <circle cx="100" cy="25" r="2.5" fill="oklch(0.65 0.24 25 / 60%)" />
            </svg>

            {/* Extra code fragments */}
            <div className="absolute bottom-[42%] left-[42%] font-mono text-[8px] text-white/15">
                computeDiff(endpointId)
            </div>

            <div className="absolute top-[62%] left-[18%] font-mono text-[8px] text-white/15">
                fetchSchemas(projectId)
            </div>

            <div className="absolute top-[68%] right-[32%] font-mono text-[8px] text-white/15">
                compareSchemas(fe, be, rt)
            </div>

            <div className="absolute top-[15%] left-[40%] font-mono text-[8px] text-white/15">
                POST /api/schemas/upload → 201
            </div>

            <div className="absolute bottom-[28%] left-[35%] font-mono text-[8px] text-white/15">
                GET /api/diff?endpoint=abc123 → 200
            </div>

            {/* Severity badges scattered */}
            <div className="absolute top-[50%] left-[30%] flex gap-1">
                <span className="text-[7px] font-mono bg-red-500/15 text-red-400/60 px-1 py-0.5 rounded">critical</span>
                <span className="text-[7px] font-mono bg-amber-500/15 text-amber-400/60 px-1 py-0.5 rounded">warning</span>
                <span className="text-[7px] font-mono bg-blue-500/15 text-blue-400/60 px-1 py-0.5 rounded">info</span>
            </div>

            {/* Source badges */}
            <div className="absolute bottom-[50%] right-[22%] flex gap-1">
                <span className="text-[7px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded" style={{ borderColor: "oklch(0.70 0.14 230 / 30%)", color: "oklch(0.70 0.14 230 / 50%)" }}>backend</span>
                <span className="text-[7px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded" style={{ borderColor: "oklch(0.75 0.15 320 / 30%)", color: "oklch(0.75 0.15 320 / 50%)" }}>frontend</span>
                <span className="text-[7px] font-mono text-white/30 border border-white/10 px-1.5 py-0.5 rounded" style={{ borderColor: "oklch(0.72 0.17 180 / 30%)", color: "oklch(0.72 0.17 180 / 50%)" }}>runtime</span>
            </div>

            {/* Mini second handshake (different endpoint) */}
            <div className="absolute bottom-[6%] left-[30%] opacity-60">
                <div className="flex items-center gap-3 font-mono text-[8px]">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-white/25">title</span>
                        <span className="text-white/25">body</span>
                        <span className="text-white/25">author</span>
                    </div>
                    <div className="flex flex-col gap-0.5 items-center">
                        <span className="text-emerald-400/40">——</span>
                        <span className="text-emerald-400/40">——</span>
                        <span className="text-red-400/40">- -</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-white/25">title</span>
                        <span className="text-white/25">body</span>
                        <span className="text-red-400/30">×</span>
                    </div>
                </div>
            </div>

            {/* Bottom center stats */}
            <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 text-center">
                <div className="font-mono text-[9px] text-white/20">
                    47 requests captured · 12 schemas analyzed · 7 endpoints · 3 projects · 0 regressions
                </div>
            </div>

            {/* Scattered dots pattern */}
            <svg className="absolute top-[35%] right-[18%] opacity-10" width="40" height="40">
                <circle cx="5" cy="5" r="1.5" fill="white" />
                <circle cx="20" cy="5" r="1.5" fill="white" />
                <circle cx="35" cy="5" r="1.5" fill="white" />
                <circle cx="5" cy="20" r="1.5" fill="white" />
                <circle cx="20" cy="20" r="1.5" fill="white" />
                <circle cx="35" cy="20" r="1.5" fill="white" />
                <circle cx="5" cy="35" r="1.5" fill="white" />
                <circle cx="20" cy="35" r="1.5" fill="white" />
                <circle cx="35" cy="35" r="1.5" fill="white" />
            </svg>

            <svg className="absolute bottom-[35%] left-[48%] opacity-10" width="40" height="40">
                <circle cx="5" cy="5" r="1.5" fill="white" />
                <circle cx="20" cy="5" r="1.5" fill="white" />
                <circle cx="35" cy="5" r="1.5" fill="white" />
                <circle cx="5" cy="20" r="1.5" fill="white" />
                <circle cx="20" cy="20" r="1.5" fill="white" />
                <circle cx="35" cy="20" r="1.5" fill="white" />
                <circle cx="5" cy="35" r="1.5" fill="white" />
                <circle cx="20" cy="35" r="1.5" fill="white" />
                <circle cx="35" cy="35" r="1.5" fill="white" />
            </svg>
        </div>
    );
}
