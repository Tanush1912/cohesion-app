"use client";

import { useMemo } from "react";
import {
    ReactFlow,
    Node,
    Edge,
    Position,
    Handle,
    Background,
    BackgroundVariant,
} from "@xyflow/react";
import { ObjectSchema, Mismatch } from "@/lib/types";

type FieldStatus = "match" | "mismatch" | "warning" | "missing";

const STATUS_COLORS: Record<FieldStatus, string> = {
    match: "var(--success)",
    mismatch: "var(--error)",
    warning: "var(--warning)",
    missing: "var(--error)",
};

const EDGE_STYLES: Record<FieldStatus, { stroke: string; strokeWidth: number }> = {
    match: { stroke: "oklch(0.72 0.19 145 / 45%)", strokeWidth: 1.8 },
    mismatch: { stroke: "oklch(0.65 0.24 25 / 70%)", strokeWidth: 2.5 },
    warning: { stroke: "oklch(0.78 0.16 75 / 70%)", strokeWidth: 2.5 },
    missing: { stroke: "oklch(0.65 0.24 25 / 70%)", strokeWidth: 2.5 },
};

function getFieldStatus(
    fieldName: string,
    mismatches: Mismatch[],
    feNames: Set<string>,
    beNames: Set<string>,
): FieldStatus {
    if (!feNames.has(fieldName) || !beNames.has(fieldName)) return "missing";
    const hits = mismatches.filter((m) => m.path.includes(fieldName));
    if (hits.length === 0) return "match";
    if (hits.some((m) => m.type === "type_mismatch" || m.type === "missing"))
        return "mismatch";
    if (hits.some((m) => m.type === "optionality_mismatch")) return "warning";
    return "mismatch";
}

function ColumnPanel({
    data,
}: {
    data: {
        label: string;
        subtitle: string;
        count: number;
        accent: string;
        width?: number;
    };
}) {
    const w = data.width ?? 200;
    return (
        <div
            style={{
                width: w,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
            }}
        >
            <div style={{ height: 3, background: data.accent }} />
            <div style={{ padding: "10px 14px" }}>
                <div
                    className="font-mono"
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--foreground)",
                    }}
                >
                    {data.label}
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 4,
                    }}
                >
                    <span
                        className="font-mono"
                        style={{ fontSize: 10, color: "var(--muted)" }}
                    >
                        {data.subtitle}
                    </span>
                    <span
                        className="font-mono"
                        style={{
                            fontSize: 9,
                            color: "var(--muted)",
                            background: "oklch(1 0 0 / 6%)",
                            padding: "1px 6px",
                            borderRadius: 8,
                        }}
                    >
                        {data.count} fields
                    </span>
                </div>
            </div>
        </div>
    );
}

function FieldCard({
    data,
}: {
    data: {
        label: string;
        type: string;
        status: FieldStatus;
        side: "fe" | "be";
        required: boolean;
    };
}) {
    const { label, type, status, side, required } = data;
    const color = STATUS_COLORS[status];
    const isBad = status === "mismatch" || status === "missing";
    const isWarn = status === "warning";

    return (
        <div
            style={{
                width: 200,
                padding: "8px 12px",
                background: isBad
                    ? "linear-gradient(135deg, oklch(0.65 0.24 25 / 10%), transparent 60%)"
                    : "var(--surface)",
                border: `1px solid ${isBad ? "oklch(0.65 0.24 25 / 40%)" : "var(--border)"}`,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                boxShadow: isBad
                    ? "0 0 12px oklch(0.65 0.24 25 / 15%)"
                    : "none",
            }}
        >
            <div
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                }}
            />
            <span
                className="font-mono"
                style={{
                    fontSize: 12,
                    color: isBad ? "var(--error)" : "var(--foreground)",
                    flex: 1,
                    opacity: required ? 1 : 0.6,
                }}
            >
                {label}
            </span>
            {type && type !== "object" && (
                <span
                    className="font-mono"
                    style={{ fontSize: 10, color: "var(--muted)", opacity: 0.7 }}
                >
                    {type}
                </span>
            )}
            {side === "be" && (isBad || isWarn) && (
                <span
                    style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: isBad ? "var(--error)" : "var(--warning)",
                        background: isBad
                            ? "oklch(0.65 0.24 25 / 15%)"
                            : "oklch(0.78 0.16 75 / 15%)",
                        padding: "1px 5px",
                        borderRadius: 4,
                    }}
                >
                    !
                </span>
            )}
            <Handle
                type={side === "fe" ? "source" : "target"}
                position={side === "fe" ? Position.Right : Position.Left}
                style={{
                    width: 10,
                    height: 10,
                    background: color,
                    border: "2px solid oklch(0.14 0.005 260)",
                    borderRadius: "50%",
                }}
            />
        </div>
    );
}

function AgreementFieldCard({
    data,
}: {
    data: { label: string; type: string; status: FieldStatus };
}) {
    const { label, type, status } = data;
    const color = STATUS_COLORS[status];
    const isBad = status === "mismatch" || status === "missing";

    const icon =
        status === "match"
            ? {
                  bg: "oklch(0.72 0.19 145 / 15%)",
                  border: "var(--success)",
                  text: "\u2713",
                  radius: "50%",
              }
            : status === "warning"
              ? {
                    bg: "oklch(0.78 0.16 75 / 15%)",
                    border: "var(--warning)",
                    text: "\u26A0",
                    radius: "4px",
                }
              : {
                    bg: "oklch(0.65 0.24 25 / 15%)",
                    border: "var(--error)",
                    text: "\u2715",
                    radius: "50%",
                };

    return (
        <div
            style={{
                width: 220,
                padding: "8px 14px",
                background: isBad
                    ? "linear-gradient(135deg, oklch(0.65 0.24 25 / 10%), transparent 60%)"
                    : "var(--surface)",
                border: `1px solid ${isBad ? "oklch(0.65 0.24 25 / 40%)" : "var(--border)"}`,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                boxShadow: isBad
                    ? "0 0 12px oklch(0.65 0.24 25 / 15%)"
                    : "none",
            }}
        >
            <div
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: icon.radius,
                    background: icon.bg,
                    border: `1.5px solid ${icon.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: icon.border,
                    flexShrink: 0,
                }}
            >
                {icon.text}
            </div>
            <span
                className="font-mono"
                style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isBad ? "var(--error)" : "var(--foreground)",
                    flex: 1,
                }}
            >
                {label}
            </span>
            {status === "missing" ? (
                <span
                    className="font-mono"
                    style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--error)",
                        background: "oklch(0.65 0.24 25 / 15%)",
                        padding: "2px 8px",
                        borderRadius: 10,
                    }}
                >
                    Missing!
                </span>
            ) : type && type !== "object" ? (
                <span
                    className="font-mono"
                    style={{ fontSize: 10, color: "var(--muted)", opacity: 0.7 }}
                >
                    {type}
                </span>
            ) : null}
            <Handle
                type="target"
                position={Position.Left}
                id="left"
                style={{
                    width: 10,
                    height: 10,
                    background: color,
                    border: "2px solid oklch(0.14 0.005 260)",
                    borderRadius: "50%",
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="right"
                style={{
                    width: 10,
                    height: 10,
                    background: color,
                    border: "2px solid oklch(0.14 0.005 260)",
                    borderRadius: "50%",
                }}
            />
        </div>
    );
}

const nodeTypes = {
    columnPanel: ColumnPanel,
    fieldCard: FieldCard,
    agreementFieldCard: AgreementFieldCard,
};

interface FieldInfo {
    name: string;
    type: string;
    required: boolean;
}

function extractFields(schema: ObjectSchema | null): FieldInfo[] {
    if (!schema?.fields) return [];
    return Object.entries(schema.fields).map(([name, field]) => ({
        name,
        type: field.type,
        required: field.required !== false,
    }));
}

interface HandshakeViewProps {
    feSchema: ObjectSchema | null;
    beSchema: ObjectSchema | null;
    rtSchema: ObjectSchema | null;
    mismatches?: Mismatch[];
}

export function HandshakeView({
    feSchema,
    beSchema,
    rtSchema,
    mismatches,
}: HandshakeViewProps) {
    mismatches = mismatches ?? [];
    const feFields = useMemo(() => extractFields(feSchema), [feSchema]);
    const beFields = useMemo(() => extractFields(beSchema), [beSchema]);

    const feNames = useMemo(
        () => new Set(feFields.map((f) => f.name)),
        [feFields],
    );
    const beNames = useMemo(
        () => new Set(beFields.map((f) => f.name)),
        [beFields],
    );

    const contractFields = useMemo(() => {
        const feTypeMap = new Map(feFields.map((f) => [f.name, f.type]));
        const beTypeMap = new Map(beFields.map((f) => [f.name, f.type]));
        const allNames = new Set([
            ...feFields.map((f) => f.name),
            ...beFields.map((f) => f.name),
        ]);

        const result: { name: string; type: string; status: FieldStatus }[] = [];

        for (const name of allNames) {
            const feType = feTypeMap.get(name);
            const beType = beTypeMap.get(name);
            const type = feType || beType || "unknown";

            let status = getFieldStatus(name, mismatches, feNames, beNames);
            if (status === "match" && feType && beType && feType !== beType) {
                status = "mismatch";
            }

            result.push({ name, type, status });
        }

        return result.sort((a, b) => a.name.localeCompare(b.name));
    }, [feFields, beFields, mismatches, feNames, beNames]);

    const { nodes, edges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        const ROW_HEIGHT = 48;
        const FE_X = 0;
        const CONTRACT_X = 280;
        const BE_X = 560;
        const HEADER_Y = 0;
        const LIST_Y = 60;

        const statusLookup = new Map(
            contractFields.map((c) => [c.name, c.status]),
        );
        const statusOf = (name: string): FieldStatus =>
            statusLookup.get(name) ?? "match";

        nodes.push({
            id: "panel-fe",
            type: "columnPanel",
            position: { x: FE_X, y: HEADER_Y },
            data: {
                label: "Frontend Intent",
                subtitle: "source fields",
                count: feFields.length,
                accent: "var(--frontend)",
            },
            draggable: false,
        });
        nodes.push({
            id: "panel-contract",
            type: "columnPanel",
            position: { x: CONTRACT_X, y: HEADER_Y },
            data: {
                label: "The Agreement",
                subtitle: "consensus",
                count: contractFields.length,
                accent: "var(--success)",
                width: 220,
            },
            draggable: false,
        });
        nodes.push({
            id: "panel-be",
            type: "columnPanel",
            position: { x: BE_X, y: HEADER_Y },
            data: {
                label: "Backend Capability",
                subtitle: "provided fields",
                count: beFields.length,
                accent: "var(--backend)",
            },
            draggable: false,
        });

        const maxRows = Math.max(
            feFields.length,
            contractFields.length,
            beFields.length,
            1,
        );
        const totalHeight = maxRows * ROW_HEIGHT;
        const feStartY =
            LIST_Y + (totalHeight - feFields.length * ROW_HEIGHT) / 2;
        const contractStartY =
            LIST_Y + (totalHeight - contractFields.length * ROW_HEIGHT) / 2;
        const beStartY =
            LIST_Y + (totalHeight - beFields.length * ROW_HEIGHT) / 2;

        feFields.forEach((field, i) => {
            const id = `fe-${field.name}`;
            const status = statusOf(field.name);
            nodes.push({
                id,
                type: "fieldCard",
                position: { x: FE_X, y: feStartY + i * ROW_HEIGHT },
                data: {
                    label: field.name,
                    type: field.type,
                    status,
                    side: "fe",
                    required: field.required,
                },
                draggable: false,
            });
            const contractId = `contract-${field.name}`;
            if (contractFields.some((c) => c.name === field.name)) {
                const es = EDGE_STYLES[status];
                edges.push({
                    id: `e-fe-${field.name}`,
                    source: id,
                    target: contractId,
                    targetHandle: "left",
                    type: "default",
                    style: {
                        stroke: es.stroke,
                        strokeWidth: es.strokeWidth,
                        strokeDasharray: field.required ? undefined : "6,4",
                    },
                });
            }
        });

        contractFields.forEach((field, i) => {
            const id = `contract-${field.name}`;
            nodes.push({
                id,
                type: "agreementFieldCard",
                position: {
                    x: CONTRACT_X,
                    y: contractStartY + i * ROW_HEIGHT,
                },
                data: {
                    label: field.name,
                    type: field.type,
                    status: field.status,
                },
                draggable: false,
            });
        });

        beFields.forEach((field, i) => {
            const id = `be-${field.name}`;
            const status = statusOf(field.name);
            nodes.push({
                id,
                type: "fieldCard",
                position: { x: BE_X, y: beStartY + i * ROW_HEIGHT },
                data: {
                    label: field.name,
                    type: field.type,
                    status,
                    side: "be",
                    required: field.required,
                },
                draggable: false,
            });
            const contractId = `contract-${field.name}`;
            if (contractFields.some((c) => c.name === field.name)) {
                const es = EDGE_STYLES[status];
                edges.push({
                    id: `e-be-${field.name}`,
                    source: contractId,
                    sourceHandle: "right",
                    target: id,
                    type: "default",
                    style: {
                        stroke: es.stroke,
                        strokeWidth: es.strokeWidth,
                        strokeDasharray: field.required ? undefined : "6,4",
                    },
                });
            }
        });

        return { nodes, edges };
    }, [feFields, beFields, contractFields]);

    if (feFields.length === 0 && beFields.length === 0) {
        return (
            <div className="w-full h-[400px] flex items-center justify-center border border-dashed border-white/5 rounded-lg bg-white/[0.02]">
                <span className="text-white/20 text-xs font-mono">
                    Upload both frontend and backend schemas to see the
                    handshake
                </span>
            </div>
        );
    }

    return (
        <div className="w-full h-[700px] rounded-xl border border-white/5 overflow-hidden bg-[#050505]">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{
                    padding: 0.15,
                    minZoom: 0.6,
                    maxZoom: 1.2,
                }}
                proOptions={{ hideAttribution: true }}
                panOnDrag={true}
                zoomOnScroll={true}
                minZoom={0.4}
                maxZoom={1.5}
                defaultEdgeOptions={{ type: "default" }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={0.5}
                    color="rgba(255,255,255,0.03)"
                />
            </ReactFlow>
        </div>
    );
}
