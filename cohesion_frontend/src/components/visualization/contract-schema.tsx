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
import { ObjectSchema, SchemaSource, Mismatch } from "@/lib/types";

type FieldStatus = "match" | "mismatch" | "warning" | "missing";

const STATUS_COLORS: Record<FieldStatus, string> = {
    match: "var(--success)",
    mismatch: "var(--error)",
    warning: "var(--warning)",
    missing: "var(--error)",
};

const FLOW_EDGE_STYLES: Record<FieldStatus, { stroke: string; strokeWidth: number }> = {
    match: { stroke: "oklch(0.72 0.19 145 / 45%)", strokeWidth: 1.8 },
    mismatch: { stroke: "oklch(0.65 0.24 25 / 70%)", strokeWidth: 2.5 },
    warning: { stroke: "oklch(0.78 0.16 75 / 70%)", strokeWidth: 2.5 },
    missing: { stroke: "oklch(0.65 0.24 25 / 70%)", strokeWidth: 2.5 },
};

const METHOD_COLORS: Record<string, string> = {
    GET: "#22c55e",
    POST: "#3b82f6",
    PUT: "#f59e0b",
    PATCH: "#f59e0b",
    DELETE: "#ef4444",
};

function getFlowFieldStatus(
    fieldName: string,
    mismatches: Mismatch[],
): FieldStatus {
    const hits = mismatches.filter((m) => m.path.includes(fieldName));
    if (hits.length === 0) return "match";
    if (hits.some((m) => m.type === "type_mismatch" || m.type === "missing"))
        return "mismatch";
    if (hits.some((m) => m.type === "optionality_mismatch")) return "warning";
    return "mismatch";
}

function ContractCenterNode({
    data,
}: {
    data: { method: string; path: string };
}) {
    const color = METHOD_COLORS[data.method?.toUpperCase()] || "#888";

    return (
        <div
            style={{
                minWidth: 180,
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: 10,
                overflow: "hidden",
                textAlign: "center",
                position: "relative",
            }}
        >
            <div style={{ height: 3, background: color }} />
            <div style={{ padding: "12px 18px" }}>
                <div
                    className="font-mono"
                    style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color,
                        marginBottom: 2,
                    }}
                >
                    {data.method?.toUpperCase()}
                </div>
                <div
                    className="font-mono"
                    style={{
                        fontSize: 14,
                        color: "var(--foreground)",
                        opacity: 0.8,
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {data.path}
                </div>
                <div
                    className="font-mono"
                    style={{
                        fontSize: 9,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        marginTop: 6,
                    }}
                >
                    contract
                </div>
            </div>
            <Handle
                type="target"
                position={Position.Left}
                style={{
                    width: 12,
                    height: 12,
                    background: color,
                    border: "2px solid oklch(0.14 0.005 260)",
                    borderRadius: "50%",
                }}
            />
            <Handle
                type="source"
                position={Position.Right}
                style={{
                    width: 12,
                    height: 12,
                    background: color,
                    border: "2px solid oklch(0.14 0.005 260)",
                    borderRadius: "50%",
                }}
            />
        </div>
    );
}

function FlowFieldCard({
    data,
}: {
    data: {
        label: string;
        type: string;
        required: boolean;
        side: "request" | "response";
        status: FieldStatus;
        depth: number;
    };
}) {
    const { label, type, required, side, status, depth } = data;
    const color = STATUS_COLORS[status];
    const isBad = status === "mismatch" || status === "missing";

    return (
        <div
            style={{
                width: 200,
                padding: "7px 12px",
                paddingLeft: 12 + depth * 14,
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
            <Handle
                type={side === "request" ? "source" : "target"}
                position={side === "request" ? Position.Right : Position.Left}
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

function FlowSectionHeader({
    data,
}: {
    data: { label: string; count: number; accent: string };
}) {
    return (
        <div
            style={{
                width: 200,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                overflow: "hidden",
            }}
        >
            <div style={{ height: 2, background: data.accent }} />
            <div
                style={{
                    padding: "6px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <span
                    className="font-mono"
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--foreground)",
                        opacity: 0.7,
                        letterSpacing: "0.05em",
                    }}
                >
                    {data.label}
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
                    {data.count}
                </span>
            </div>
        </div>
    );
}

const nodeTypes = {
    contract: ContractCenterNode,
    field: FlowFieldCard,
    sectionLabel: FlowSectionHeader,
};

interface FieldEntry {
    name: string;
    type: string;
    required: boolean;
    depth: number;
}

function extractFields(schema: ObjectSchema | null, depth = 0): FieldEntry[] {
    if (!schema?.fields) return [];
    const entries: FieldEntry[] = [];
    Object.entries(schema.fields).forEach(([name, field]) => {
        entries.push({
            name,
            type: field.type,
            required: field.required !== false,
            depth,
        });
        if (field.nested) {
            entries.push(...extractFields(field.nested, depth + 1));
        }
    });
    return entries;
}

interface ContractFlowProps {
    requestSchema: ObjectSchema | null;
    responseSchema: ObjectSchema | null;
    source: SchemaSource;
    method?: string;
    path?: string;
    mismatches?: Mismatch[];
}

export function ContractFlow({
    requestSchema,
    responseSchema,
    source,
    method = "GET",
    path = "/endpoint",
    mismatches,
}: ContractFlowProps) {
    mismatches = mismatches ?? [];
    const requestFields = useMemo(
        () => extractFields(requestSchema),
        [requestSchema],
    );
    const responseFields = useMemo(
        () => extractFields(responseSchema),
        [responseSchema],
    );

    const { nodes, edges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        const ROW_HEIGHT = 44;
        const REQUEST_X = 20;
        const CENTER_X = 410;
        const RESPONSE_X = 600;

        const methodColor =
            METHOD_COLORS[method?.toUpperCase()] || "#888";

        const maxFields = Math.max(
            requestFields.length,
            responseFields.length,
            1,
        );
        const centerY = (maxFields * ROW_HEIGHT) / 2 + 50;

        nodes.push({
            id: "contract",
            type: "contract",
            position: { x: CENTER_X - 90, y: centerY - 40 },
            data: { method, path },
            draggable: false,
        });

        if (requestFields.length > 0) {
            const startY =
                centerY - (requestFields.length * ROW_HEIGHT) / 2;

            nodes.push({
                id: "req-label",
                type: "sectionLabel",
                position: { x: REQUEST_X, y: startY - 36 },
                data: {
                    label: "REQUEST \u2192",
                    count: requestFields.length,
                    accent: methodColor,
                },
                draggable: false,
            });

            requestFields.forEach((field, i) => {
                const y = startY + i * ROW_HEIGHT;
                const id = `req-${field.name}-${i}`;
                const status = getFlowFieldStatus(field.name, mismatches);
                const es = FLOW_EDGE_STYLES[status];

                nodes.push({
                    id,
                    type: "field",
                    position: { x: REQUEST_X, y },
                    data: {
                        label: field.name,
                        type: field.type,
                        required: field.required,
                        side: "request",
                        status,
                        depth: field.depth,
                    },
                    draggable: false,
                });

                edges.push({
                    id: `e-${id}`,
                    source: id,
                    target: "contract",
                    type: "default",
                    style: {
                        stroke: es.stroke,
                        strokeWidth: es.strokeWidth,
                        strokeDasharray: field.required ? undefined : "6,4",
                    },
                });
            });
        } else {
            nodes.push({
                id: "req-label",
                type: "sectionLabel",
                position: { x: REQUEST_X, y: centerY - 14 },
                data: {
                    label: "NO BODY",
                    count: 0,
                    accent: "var(--muted)",
                },
                draggable: false,
            });
        }

        if (responseFields.length > 0) {
            const startY =
                centerY - (responseFields.length * ROW_HEIGHT) / 2;

            nodes.push({
                id: "res-label",
                type: "sectionLabel",
                position: { x: RESPONSE_X, y: startY - 36 },
                data: {
                    label: "\u2192 RESPONSE",
                    count: responseFields.length,
                    accent: methodColor,
                },
                draggable: false,
            });

            responseFields.forEach((field, i) => {
                const y = startY + i * ROW_HEIGHT;
                const id = `res-${field.name}-${i}`;
                const status = getFlowFieldStatus(field.name, mismatches);
                const es = FLOW_EDGE_STYLES[status];

                nodes.push({
                    id,
                    type: "field",
                    position: { x: RESPONSE_X, y },
                    data: {
                        label: field.name,
                        type: field.type,
                        required: field.required,
                        side: "response",
                        status,
                        depth: field.depth,
                    },
                    draggable: false,
                });

                edges.push({
                    id: `e-${id}`,
                    source: "contract",
                    target: id,
                    type: "default",
                    style: {
                        stroke: es.stroke,
                        strokeWidth: es.strokeWidth,
                        strokeDasharray: field.required ? undefined : "6,4",
                    },
                });
            });
        } else {
            nodes.push({
                id: "res-label",
                type: "sectionLabel",
                position: { x: RESPONSE_X, y: centerY - 14 },
                data: {
                    label: "NO BODY",
                    count: 0,
                    accent: "var(--muted)",
                },
                draggable: false,
            });
        }

        return { nodes, edges };
    }, [requestFields, responseFields, method, path, mismatches]);

    if (requestFields.length === 0 && responseFields.length === 0) {
        return (
            <div className="w-full min-h-[200px] flex items-center justify-center border border-dashed border-white/5 rounded-lg bg-white/[0.02]">
                <span className="text-white/20 text-xs font-mono">
                    no contract data
                </span>
            </div>
        );
    }

    return (
        <div className="w-full h-[500px] rounded-lg border border-white/5 overflow-hidden bg-[#060606]">
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
                    gap={20}
                    size={0.5}
                    color="rgba(255,255,255,0.03)"
                />
            </ReactFlow>
        </div>
    );
}

interface ContractSchemaProps {
    schema: ObjectSchema | null;
    source: SchemaSource;
    mismatches?: Mismatch[];
    title?: string;
}

export function ContractSchema({
    schema,
    source,
    mismatches,
    title = "Schema",
}: ContractSchemaProps) {
    mismatches = mismatches ?? [];
    const fields = useMemo(() => {
        if (!schema?.fields) return [];
        return Object.entries(schema.fields).map(([name, field]) => ({
            name,
            type: field.type,
            required: field.required !== false,
        }));
    }, [schema]);

    if (!schema || fields.length === 0) {
        return (
            <div className="w-full min-h-[80px] flex items-center justify-start pl-4">
                <span className="text-white/20 text-xs font-mono">
                    no data
                </span>
            </div>
        );
    }

    const isRequest = title.toLowerCase().includes("request");

    return (
        <div className="space-y-1">
            {fields.map((field) => {
                const opacity = field.required ? 0.9 : 0.4;
                return (
                    <div
                        key={field.name}
                        className="flex items-center gap-3 py-1"
                    >
                        <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                                background: field.required
                                    ? "rgba(255,255,255,0.5)"
                                    : "transparent",
                                border: field.required
                                    ? "none"
                                    : "1px solid rgba(255,255,255,0.3)",
                            }}
                        />
                        <span
                            className="text-xs font-mono"
                            style={{
                                color: `rgba(255,255,255,${opacity})`,
                                fontWeight: field.required ? 500 : 400,
                            }}
                        >
                            {field.name}
                        </span>
                        {field.type && field.type !== "object" && (
                            <span
                                className="text-[9px] font-mono"
                                style={{
                                    color: `rgba(255,255,255,${opacity * 0.4})`,
                                }}
                            >
                                {field.type}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
