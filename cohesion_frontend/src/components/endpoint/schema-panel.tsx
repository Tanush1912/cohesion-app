"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ObjectSchema, SchemaSource, Mismatch } from "@/lib/types";

interface SourceTabsProps {
    schemas: { source: SchemaSource; schema: ObjectSchema | null }[];
    activeSource: SchemaSource;
    onSourceChange: (source: SchemaSource) => void;
}

const sourceLabels: Record<SchemaSource, string> = {
    "backend-static": "BE",
    "frontend-static": "FE",
    "runtime-observed": "RT",
    "handshake": "🤝 HANDSHAKE",
};

export function SourceTabs({ schemas, activeSource, onSourceChange }: SourceTabsProps) {
    return (
        <div className="flex gap-1 text-xs font-mono">
            {schemas.map(({ source, schema }) => {
                const isActive = activeSource === source;
                const hasData = schema !== null;

                return (
                    <button
                        key={source}
                        onClick={() => hasData && onSourceChange(source)}
                        disabled={!hasData}
                        className={cn(
                            "px-3 py-1.5 rounded border transition-colors",
                            isActive
                                ? "border-white/40 bg-white/10 text-white"
                                : hasData
                                    ? "border-white/10 text-white/50 hover:text-white hover:border-white/20"
                                    : "border-white/5 text-white/20 cursor-not-allowed"
                        )}
                    >
                        {sourceLabels[source]}
                    </button>
                );
            })}
        </div>
    );
}

interface SchemaViewProps {
    schema: ObjectSchema | null;
    title?: string;
    mismatches?: Mismatch[];
}

function FieldDisplay({
    name,
    field,
    depth = 0,
    path = "",
    mismatches = [],
}: {
    name: string;
    field: { type: string; required: boolean; nested?: ObjectSchema };
    depth?: number;
    path?: string;
    mismatches?: Mismatch[];
}) {
    const currentPath = path ? `${path}.${name}` : name;
    const mismatch = mismatches.find((m) => m.path.endsWith(currentPath));

    return (
        <div style={{ marginLeft: depth * 12 }}>
            <div className={cn(
                "flex items-center gap-2 py-0.5 text-sm font-mono",
                mismatch && "text-red-400"
            )}>
                <span className="text-white/30">├─</span>
                <span className={mismatch ? "text-red-400" : "text-white/80"}>{name}</span>
                <span className="text-white/30">{field.type}{!field.required && "?"}</span>
            </div>

            {field.nested && field.nested.fields && (
                <div>
                    {Object.entries(field.nested.fields).map(([fieldName, nestedField]) => (
                        <FieldDisplay
                            key={fieldName}
                            name={fieldName}
                            field={nestedField}
                            depth={depth + 1}
                            path={currentPath}
                            mismatches={mismatches}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function SchemaView({ schema, title = "Schema", mismatches = [] }: SchemaViewProps) {
    if (!schema) {
        return (
            <div className="text-sm text-white/40">No schema</div>
        );
    }

    return (
        <div className="font-mono text-sm">
            <div className="text-white/60 mb-2">{title}</div>
            {schema.fields && Object.keys(schema.fields).length > 0 ? (
                <div>
                    {Object.entries(schema.fields).map(([name, field]) => (
                        <FieldDisplay
                            key={name}
                            name={name}
                            field={field}
                            path={title.toLowerCase()}
                            mismatches={mismatches}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-white/30">No fields</div>
            )}
        </div>
    );
}
