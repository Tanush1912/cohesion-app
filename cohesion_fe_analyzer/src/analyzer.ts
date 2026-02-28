import { Project, SyntaxKind, CallExpression, PropertyAccessExpression, Type, TypeFormatFlags } from "ts-morph";
import * as path from "path";

export interface SchemaIR {
    endpoint: string;
    method: string;
    source: "frontend-static";
    request?: ObjectSchema;
    response?: Record<number, ObjectSchema>;
}

export interface ObjectSchema {
    type: string;
    fields?: Record<string, Field>;
    items?: ObjectSchema;
}

export interface Field {
    type: string;
    required: boolean;
    nested?: ObjectSchema;
}

interface Parser {
    parse(call: CallExpression): SchemaIR | null;
}

interface FetcherInfo {
    paramIndex: number;
    method?: string;
}
export class FrontendAnalyzer {
    private project: Project;
    private parsers: Parser[] = [];
    private allFetchers: Map<string, FetcherInfo> = new Map();

    constructor(projectPath: string) {
        this.project = new Project({
            tsConfigFilePath: path.join(projectPath, "tsconfig.json"),
            skipAddingFilesFromTsConfig: false,
        });

        this.project.addSourceFilesAtPaths(path.join(projectPath, "src/**/*.{ts,tsx}"));
        this.project.addSourceFilesAtPaths(path.join(projectPath, "app/**/*.{ts,tsx}"));
        this.project.addSourceFilesAtPaths(path.join(projectPath, "components/**/*.{ts,tsx}"));
        this.project.addSourceFilesAtPaths(path.join(projectPath, "lib/**/*.{ts,tsx}"));
        this.project.addSourceFilesAtPaths(path.join(projectPath, "hooks/**/*.{ts,tsx}"));

        this.discoverFetchers();
        console.log(`Discovered ${this.allFetchers.size} fetcher wrappers`);
        this.setupParsers();
    }

    private setupParsers() {
        this.parsers = [
            { parse: (call) => this.parseFetchCall(call) },
            { parse: (call) => this.parseAxiosCall(call) },
            { parse: (call) => this.parseTanStackQueryCall(call) },
            { parse: (call) => this.parseGenericFetcherCall(call) },
        ];
    }

    analyze(): SchemaIR[] {
        const schemasMap = new Map<string, SchemaIR>();
        const sourceFiles = this.project.getSourceFiles();

        for (const sourceFile of sourceFiles) {
            sourceFile.forEachDescendant(node => {
                if (node.getKind() === SyntaxKind.CallExpression) {
                    const callExpr = node as CallExpression;
                    for (const parser of this.parsers) {
                        try {
                            const schema = parser.parse(callExpr);
                            if (schema) {
                                const key = `${schema.method}:${schema.endpoint}`;
                                if (schemasMap.has(key)) {
                                    this.mergeSchemas(schemasMap.get(key)!, schema);
                                } else {
                                    schemasMap.set(key, schema);
                                }
                                break;
                            }
                        } catch (e) {
                        }
                    }
                }
            });
        }

        return Array.from(schemasMap.values());
    }

    private mergeSchemas(target: SchemaIR, source: SchemaIR) {
        if (source.request && !target.request) target.request = source.request;
        if (source.response) {
            if (!target.response) target.response = source.response;
            else {
                for (const [code, schema] of Object.entries(source.response)) {
                    if (!target.response[Number(code)]) target.response[Number(code)] = schema;
                }
            }
        }
    }

    private discoverFetchers() {
        this.allFetchers.set("fetch", { paramIndex: 0 });
        this.allFetchers.set("axios", { paramIndex: 0 });
        this.allFetchers.set("axios.get", { paramIndex: 0, method: "GET" });
        this.allFetchers.set("axios.post", { paramIndex: 0, method: "POST" });
        this.allFetchers.set("axios.put", { paramIndex: 0, method: "PUT" });
        this.allFetchers.set("axios.delete", { paramIndex: 0, method: "DELETE" });
        this.allFetchers.set("useSWR", { paramIndex: 0 });
        this.allFetchers.set("useQuery", { paramIndex: 0 });

        let foundNew = true;
        while (foundNew) {
            foundNew = false;
            for (const file of this.project.getSourceFiles()) {
                file.forEachDescendant(node => {
                    const kind = node.getKind();
                    if (kind === SyntaxKind.FunctionDeclaration || kind === SyntaxKind.ArrowFunction || kind === SyntaxKind.MethodDeclaration) {
                        const fn = node as any;
                        const name = fn.getName?.() || (kind === SyntaxKind.ArrowFunction ? fn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getName() : null);
                        if (!name || this.allFetchers.has(name)) return;

                        fn.forEachDescendant((child: any) => {
                            if (child.getKind() === SyntaxKind.CallExpression) {
                                const call = child as CallExpression;
                                const calleeText = call.getExpression().getText();

                                for (const [fName, info] of this.allFetchers.entries()) {
                                    if (calleeText === fName || calleeText.endsWith("." + fName)) {
                                        const args = call.getArguments();
                                        if (args.length > info.paramIndex) {
                                            const arg = args[info.paramIndex];
                                            const param = fn.getParameters().find((p: any) => {
                                                const argText = arg.getText();
                                                return p.getName() === argText ||
                                                    (arg.getKind() === SyntaxKind.TemplateExpression && arg.getText().includes("${" + p.getName() + "}"));
                                            });
                                            if (param) {
                                                const paramIndex = fn.getParameters().indexOf(param);
                                                this.allFetchers.set(name, { paramIndex });
                                                foundNew = true;
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
            }
        }
    }

    private parseTanStackQueryCall(call: CallExpression): SchemaIR | null {
        const text = call.getExpression().getText();
        if (text !== "useQuery" && text !== "useMutation") return null;

        const args = call.getArguments();
        if (args.length === 0) return null;

        let url: string | null = null;
        let method = text === "useMutation" ? "POST" : "GET";

        if (args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
            const options = args[0].asKind(SyntaxKind.ObjectLiteralExpression);
            const queryKey = options?.getProperty("queryKey");
            if (queryKey && queryKey.getKind() === SyntaxKind.PropertyAssignment) {
                const init = (queryKey as any).getInitializer();
                if (init && init.getKind() === SyntaxKind.ArrayLiteralExpression) {
                    const elements = init.getElements();
                    if (elements.length > 0) {
                        url = this.resolveUrl(elements[0]);
                    }
                }
            }
        }

        if (!url || !this.isValidApiUrl(url, text)) return null;

        const typeArgs = call.getTypeArguments();
        let responseType: Type | undefined;
        if (typeArgs.length > 0) {
            responseType = typeArgs[0].getType();
        }

        return {
            endpoint: url,
            method: method,
            source: "frontend-static",
            response: responseType ? { 200: this.typeToSchema(responseType) } : undefined
        };
    }

    private parseFetchCall(call: CallExpression): SchemaIR | null {
        const text = call.getExpression().getText();
        if (text !== "fetch" && text !== "fetchAPI" && !text.endsWith(".fetchAPI")) return null;

        const args = call.getArguments();
        if (args.length === 0) return null;

        const url = this.resolveUrl(args[0]);
        if (!url || !this.isValidApiUrl(url, text)) return null;

        let method = "GET";
        let requestType: Type | undefined;

        if (args.length >= 2 && args[1].getKind() === SyntaxKind.ObjectLiteralExpression) {
            const options = args[1].asKind(SyntaxKind.ObjectLiteralExpression);
            const methodProp = options?.getProperty("method");
            if (methodProp && methodProp.getKind() === SyntaxKind.PropertyAssignment) {
                const init = (methodProp as any).getInitializer();
                if (init) method = init.getText().replace(/['"]/g, "").toUpperCase();
            }

            const bodyProp = options?.getProperty("body");
            if (bodyProp && bodyProp.getKind() === SyntaxKind.PropertyAssignment) {
                const init = (bodyProp as any).getInitializer();
                if (init) {
                    if (init.getKind() === SyntaxKind.CallExpression) {
                        const bodyCall = init as CallExpression;
                        if (bodyCall.getExpression().getText() === "JSON.stringify" && bodyCall.getArguments().length > 0) {
                            requestType = bodyCall.getArguments()[0].getType();
                        } else {
                            requestType = init.getType();
                        }
                    } else {
                        requestType = init.getType();
                    }
                }
            }
        }

        const responseType = this.findResponseTypeFromFetch(call);

        return {
            endpoint: url,
            method: method,
            source: "frontend-static",
            request: requestType ? this.typeToSchema(requestType) : undefined,
            response: responseType ? { 200: this.typeToSchema(responseType) } : undefined
        };
    }

    private parseAxiosCall(call: CallExpression): SchemaIR | null {
        const expr = call.getExpression();
        const text = expr.getText();
        if (!text.startsWith("axios.") && text !== "axios") return null;

        let method = "GET";
        let urlArgIndex = 0;
        let dataArgIndex = 1;

        if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = expr as PropertyAccessExpression;
            const methodName = propAccess.getName();
            if (["get", "post", "put", "delete", "patch"].includes(methodName)) {
                method = methodName.toUpperCase();
            }
        } else if (text === "axios") {
            return null;
        }

        const args = call.getArguments();
        if (args.length === 0) return null;

        const url = this.resolveUrl(args[urlArgIndex]);
        if (!url || !this.isValidApiUrl(url, text)) return null;

        const requestType = method !== "GET" && args.length > dataArgIndex ? args[dataArgIndex].getType() : undefined;

        const typeArgs = call.getTypeArguments();
        let responseType: Type | undefined;
        if (typeArgs.length > 0) {
            responseType = typeArgs[0].getType();
        }

        return {
            endpoint: url,
            method: method,
            source: "frontend-static",
            request: requestType ? this.typeToSchema(requestType) : undefined,
            response: responseType ? { 200: this.typeToSchema(responseType) } : undefined
        };
    }

    private parseGenericFetcherCall(call: CallExpression): SchemaIR | null {
        const expr = call.getExpression();
        const text = expr.getText();
        let info = this.allFetchers.get(text);

        if (!info && text.includes(".")) {
            info = this.allFetchers.get(text.split(".").pop() || "");
        }

        if (!info) {
            const lowText = text.toLowerCase();
            if (lowText.includes("fetch") || lowText.includes("api") || lowText.includes("request")) {
                info = { paramIndex: 0 };
            }
        }

        if (!info) return null;

        const args = call.getArguments();
        if (args.length <= info.paramIndex) return null;

        const url = this.resolveUrl(args[info.paramIndex]);
        if (!url || !this.isValidApiUrl(url, text)) return null;

        let method = info.method || "GET";
        const fullName = text.toLowerCase();
        if (fullName.includes("post") || fullName.includes("create")) method = "POST";
        else if (fullName.includes("put") || fullName.includes("update")) method = "PUT";
        else if (fullName.includes("delete") || fullName.includes("remove")) method = "DELETE";

        for (const arg of args) {
            const obj = (arg.getKind() === SyntaxKind.ObjectLiteralExpression) ? arg.asKind(SyntaxKind.ObjectLiteralExpression) : null;
            if (obj) {
                const methodProp = obj.getProperty("method");
                if (methodProp) {
                    const init = (methodProp as any).getInitializer();
                    if (init) {
                        const m = this.resolveUrl(init);
                        if (m) method = m.toUpperCase();
                    }
                }
            }
        }

        let requestType: Type | undefined;
        for (const arg of args) {
            const obj = (arg.getKind() === SyntaxKind.ObjectLiteralExpression) ? arg.asKind(SyntaxKind.ObjectLiteralExpression) : null;
            if (obj) {
                const bodyProp = obj.getProperty("body") || obj.getProperty("data");
                if (bodyProp) {
                    const initializer = (bodyProp as any).getInitializer();
                    if (initializer && initializer.getKind() === SyntaxKind.CallExpression) {
                        const call = initializer as CallExpression;
                        if (call.getExpression().getText() === "JSON.stringify" && call.getArguments().length > 0) {
                            requestType = call.getArguments()[0].getType();
                        } else {
                            requestType = initializer.getType();
                        }
                    } else if (initializer) {
                        requestType = initializer.getType();
                    }
                }
            }
            else if (method !== "GET" && args.indexOf(arg) !== info.paramIndex && !this.isValidApiUrl(this.resolveUrl(arg) || "", text)) {
                requestType = arg.getType();
            }
        }

        const responseType = this.findResponseTypeFromFetch(call);

        return {
            endpoint: url,
            method: method,
            source: "frontend-static",
            request: requestType ? this.typeToSchema(requestType) : undefined,
            response: responseType ? { 200: this.typeToSchema(responseType) } : undefined
        };
    }

    private resolveUrl(node: any): string | null {
        const kind = node.getKind();

        if (kind === SyntaxKind.StringLiteral) {
            return node.getText().replace(/['"]/g, "");
        }
        if (kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
            return node.getText().replace(/[`]/g, "");
        }
        if (kind === SyntaxKind.TemplateExpression) {
            const template = node.asKind(SyntaxKind.TemplateExpression);
            let result = template.getHead().getLiteralText();
            for (const span of template.getTemplateSpans()) {
                const expr = span.getExpression();
                const resolvedPart = this.resolveUrl(expr);
                result += resolvedPart ? resolvedPart : `{${expr.getText()}}`;
                result += span.getLiteral().getLiteralText();
            }
            return result;
        }

        if (kind === SyntaxKind.Identifier) {
            const name = node.getText();
            if (name === "BACKEND_URL" || name === "NEXT_PUBLIC_BACKEND_URL") {
                return "{BACKEND_URL}";
            }

            const symbol = node.getSymbol();
            if (symbol) {
                const declarations = symbol.getDeclarations();
                for (const decl of declarations) {
                    if (decl.getKind() === SyntaxKind.VariableDeclaration) {
                        const initializer = (decl as any).getInitializer();
                        if (initializer) return this.resolveUrl(initializer);
                    }
                }
            }
        }

        if (kind === SyntaxKind.ArrayLiteralExpression) {
            const elements = node.asKind(SyntaxKind.ArrayLiteralExpression).getElements();
            if (elements.length > 0) return this.resolveUrl(elements[0]);
        }

        if (kind === SyntaxKind.PropertyAccessExpression) {
            const text = node.getText();
            if (text.includes("process.env")) {
                return `{${text.split(".").pop()}}`;
            }
        }

        if (kind === SyntaxKind.ConditionalExpression) {
            const cond = node.asKind(SyntaxKind.ConditionalExpression);
            const whenTrue = this.resolveUrl(cond.getWhenTrue());
            const whenFalse = this.resolveUrl(cond.getWhenFalse());
            return whenTrue || whenFalse;
        }

        return null;
    }

    private isValidApiUrl(url: string, callee?: string): boolean {
        const isHook = callee === "useQuery" || callee === "useSWR";

        if (!isHook && !url.includes("/")) return false;

        if (url.endsWith(":") || url.includes("Error") || url.length > 200) {
            return false;
        }

        if (url.startsWith("{") && url.endsWith("}") && !url.includes("/")) {
            return false;
        }

        return true;
    }

    private findResponseTypeFromFetch(call: CallExpression): Type | undefined {
        const typeArgs = call.getTypeArguments();
        if (typeArgs.length > 0) {
            return typeArgs[0].getType();
        }

        const parent = call.getParent();
        if (parent && parent.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = parent as PropertyAccessExpression;
            if (propAccess.getName() === "then") {
                const thenCall = propAccess.getParent() as CallExpression;
                const thenArgs = thenCall.getArguments();
                if (thenArgs.length > 0 && (thenArgs[0].getKind() === SyntaxKind.ArrowFunction || thenArgs[0].getKind() === SyntaxKind.FunctionExpression)) {
                    const callback = thenArgs[0] as any;
                    return callback.getReturnType();
                }
            }
        }
        return undefined;
    }

    private typeToSchema(type: Type, visited: string[] = []): ObjectSchema {
        if (type.isString()) return { type: "string" };
        if (type.isNumber()) return { type: "number" };
        if (type.isBoolean()) return { type: "boolean" };

        if (type.isArray()) {
            return {
                type: "array",
                items: this.typeToSchema(type.getArrayElementType()!, visited)
            };
        }

        if (type.isObject() || type.isClass()) {
            const typeName = type.getText(undefined, TypeFormatFlags.None);
            if (visited.includes(typeName)) return { type: "object" };

            const fields: Record<string, Field> = {};
            const properties = type.getProperties();

            for (const prop of properties) {
                const name = prop.getName();
                const propType = prop.getTypeAtLocation(prop.getValueDeclaration()!);
                
                if (propType.getCallSignatures().length > 0) continue;

                fields[name] = {
                    type: this.getBasicType(propType),
                    required: !prop.isOptional(),
                    nested: this.isComplexType(propType) ? this.typeToSchema(propType, [...visited, typeName]) : undefined
                };
            }

            return {
                type: "object",
                fields: fields
            };
        }

        return { type: "any" };
    }

    private getBasicType(type: Type): string {
        if (type.isString()) return "string";
        if (type.isNumber()) return "number";
        if (type.isBoolean()) return "boolean";
        if (type.isArray()) return "array";
        return "object";
    }

    private isComplexType(type: Type): boolean {
        return (type.isObject() || type.isClass() || type.isArray()) && type.getCallSignatures().length === 0;
    }
}
