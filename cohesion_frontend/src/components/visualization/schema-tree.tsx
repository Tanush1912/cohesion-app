"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { ObjectSchema, SchemaSource, Mismatch } from "@/lib/types";

interface TreeNode {
    name: string;
    type: string;
    required?: boolean;
    mismatch?: Mismatch;
    children?: TreeNode[];
}

interface SchemaTreeProps {
    schema: ObjectSchema | null;
    source: SchemaSource;
    mismatches?: Mismatch[];
    title?: string;
}

function schemaToTree(
    schema: ObjectSchema | null,
    name: string,
    mismatches: Mismatch[],
    path: string = ""
): TreeNode | null {
    if (!schema) return null;

    const currentPath = path ? `${path}.${name}` : name;
    const mismatch = mismatches.find((m) => m.path === currentPath);

    const node: TreeNode = {
        name,
        type: schema.type,
        mismatch,
        children: [],
    };

    if (schema.fields) {
        node.children = Object.entries(schema.fields).map(([fieldName, field]) => {
            const fieldPath = `${currentPath}.${fieldName}`;
            const fieldMismatch = mismatches.find((m) => m.path === fieldPath);

            const childNode: TreeNode = {
                name: fieldName,
                type: field.type,
                required: field.required,
                mismatch: fieldMismatch,
                children: [],
            };

            if (field.nested) {
                const nestedTree = schemaToTree(field.nested, fieldName, mismatches, currentPath);
                if (nestedTree) {
                    childNode.children = nestedTree.children;
                }
            }

            return childNode;
        });
    }

    return node;
}

export function SchemaTree({ schema, source, mismatches: _mismatches, title = "Schema" }: SchemaTreeProps) {
    const mismatches = _mismatches ?? [];
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: Math.max(250, entry.contentRect.height),
                });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!svgRef.current || !schema) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 16, right: 100, bottom: 16, left: 50 };
        const width = dimensions.width - margin.left - margin.right;
        const height = dimensions.height - margin.top - margin.bottom;

        const g = svg
            .attr("width", dimensions.width)
            .attr("height", dimensions.height)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const treeData = schemaToTree(schema, title, mismatches);
        if (!treeData) return;

        const root = d3.hierarchy(treeData);
        const treeLayout = d3.tree<TreeNode>().size([height, width]);
        const treeNodes = treeLayout(root);

        g.selectAll(".link")
            .data(treeNodes.links())
            .enter()
            .append("path")
            .attr("fill", "none")
            .attr("stroke", (d) => {
                if (d.target.data.mismatch) {
                    const type = d.target.data.mismatch.type;
                    if (type === "missing" || type === "type_mismatch") return "#f87171";
                    if (type === "optionality_mismatch") return "#fbbf24";
                }
                return "rgba(255,255,255,0.15)";
            })
            .attr("stroke-width", 1)
            .attr(
                "d",
                d3
                    .linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
                    .x((d) => d.y)
                    .y((d) => d.x)
            );

        const node = g
            .selectAll(".node")
            .data(treeNodes.descendants())
            .enter()
            .append("g")
            .attr("transform", (d) => `translate(${d.y},${d.x})`);

        node
            .append("circle")
            .attr("r", 3)
            .attr("fill", (d) => {
                if (d.data.mismatch) {
                    const { type, severity } = d.data.mismatch;
                    if (severity === "info") return "#60a5fa";
                    if (type === "missing" || type === "type_mismatch") return "#f87171";
                    if (type === "optionality_mismatch") return "#fbbf24";
                }
                return "rgba(255,255,255,0.5)";
            });

        node
            .append("text")
            .attr("dy", "0.35em")
            .attr("x", (d) => (d.children ? -8 : 8))
            .attr("text-anchor", (d) => (d.children ? "end" : "start"))
            .attr("fill", "rgba(255,255,255,0.8)")
            .attr("font-size", "11px")
            .attr("font-family", "JetBrains Mono, monospace")
            .text((d) => d.data.name);

        node
            .filter((d): boolean => !!(d.data.type && d.data.type !== "object"))
            .append("text")
            .attr("dy", "0.35em")
            .attr("x", (d) => (d.children ? -8 : 8) + (d.children ? -40 : 40))
            .attr("text-anchor", (d) => (d.children ? "end" : "start"))
            .attr("fill", "rgba(255,255,255,0.3)")
            .attr("font-size", "10px")
            .attr("font-family", "JetBrains Mono, monospace")
            .text((d) => d.data.type + (d.data.required === false ? "?" : ""));
    }, [schema, mismatches, dimensions, title]);

    if (!schema) {
        return (
            <div ref={containerRef} className="flex items-center justify-center h-full text-white/40 text-sm">
                No schema data
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full min-h-[250px]">
            <svg ref={svgRef} className="w-full h-full" />
        </div>
    );
}
