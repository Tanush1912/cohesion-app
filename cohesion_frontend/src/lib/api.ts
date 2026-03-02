import { Project, Endpoint, DiffResult, SchemaIR, LiveCapturedRequest, LiveDiffResponse } from "./types";
import { getAuthToken } from "@/lib/auth";
import { captureAround } from "@/lib/live-capture";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function requestWithToken(
    path: string,
    options?: RequestInit,
    forceRefreshToken = false,
): Promise<Response> {
    const token = await getAuthToken(forceRefreshToken);

    const method = options?.method || "GET";
    let requestBody: unknown | undefined;
    if (options?.body && typeof options.body === "string") {
        try { requestBody = JSON.parse(options.body); } catch { /* not JSON */ }
    }

    return captureAround(path, method, requestBody, () =>
        fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options?.headers,
            },
        }),
    );
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
    let res = await requestWithToken(path, options);
    let body = await res.json().catch(() => null);

    if (
        res.status === 401 &&
        body?.error === "invalid token"
    ) {
        res = await requestWithToken(path, options, true);
        body = await res.json().catch(() => null);
    }

    if (!res.ok) {
        const message = body?.error || `HTTP ${res.status} ${res.statusText}`;
        throw new Error(message);
    }

    return body as T;
}

export const api = {
    health: () => fetchAPI<{ status: string }>("/api/health"),

    projects: {
        list: () => fetchAPI<Project[]>("/api/projects"),
        get: (id: string) => fetchAPI<Project>(`/api/projects/${id}`),
        create: (name: string, description: string) =>
            fetchAPI<Project>("/api/projects", {
                method: "POST",
                body: JSON.stringify({ name, description }),
            }),
        delete: (id: string) =>
            fetchAPI<void>(`/api/projects/${id}`, { method: "DELETE" }),
    },

    endpoints: {
        list: (projectId: string) =>
            fetchAPI<Endpoint[]>(`/api/endpoints?project_id=${projectId}`),
        get: (id: string) => fetchAPI<Endpoint>(`/api/endpoints/${id}`),
    },

    schemas: {
        uploadBackend: (projectId: string, schemas: SchemaIR[]) =>
            fetchAPI<{ message: string }>("/api/analyze/backend", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId, schemas }),
            }),
        uploadFrontend: (projectId: string, schemas: SchemaIR[]) =>
            fetchAPI<{ message: string }>("/api/analyze/frontend", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId, schemas }),
            }),
        uploadRuntime: (projectId: string, schemas: SchemaIR[]) =>
            fetchAPI<{ message: string }>("/api/analyze/runtime", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId, schemas }),
            }),
        scan: (projectId: string, params: {
            dir_path?: string;
            files?: Array<{ path: string; content: string }>;
            scan_type: "backend" | "frontend";
        }) =>
            fetchAPI<{ message: string; count: number }>("/api/analyze/scan", {
                method: "POST",
                body: JSON.stringify({
                    project_id: projectId,
                    ...params,
                }),
            }),
        scanGitHub: (projectId: string, params: {
            repo_url: string;
            branch?: string;
            path?: string;
            scan_type: "backend" | "frontend";
        }) =>
            fetchAPI<{ message: string; count: number }>("/api/analyze/github", {
                method: "POST",
                body: JSON.stringify({
                    project_id: projectId,
                    ...params,
                }),
            }),
    },

    diff: {
        compute: (endpointId: string) =>
            fetchAPI<DiffResult>(`/api/diff/${endpointId}`, { method: "POST" }),
    },

    stats: {
        get: () =>
            fetchAPI<{ matched: number; partial: number; violations: number }>("/api/stats"),
    },

    userSettings: {
        get: () =>
            fetchAPI<{ gemini_api_key: string; gemini_model: string; github_token: string }>("/api/user/settings"),
        save: (geminiApiKey: string, geminiModel: string, githubToken: string) =>
            fetchAPI<{ message: string }>("/api/user/settings", {
                method: "PUT",
                body: JSON.stringify({ gemini_api_key: geminiApiKey, gemini_model: geminiModel, github_token: githubToken }),
            }),
    },

    github: {
        status: () =>
            fetchAPI<{ configured: boolean; install_url?: string }>("/api/github/status"),
        saveInstallation: (installationId: number) =>
            fetchAPI<{ message: string; installation_id: number; github_account_login: string; github_account_type: string }>(
                "/api/github/installations",
                {
                    method: "POST",
                    body: JSON.stringify({ installation_id: installationId }),
                },
            ),
        listInstallations: () =>
            fetchAPI<Array<{
                id: string;
                installation_id: number;
                github_account_login: string;
                github_account_type: string;
                created_at: string;
            }>>("/api/github/installations"),
        removeInstallation: (installationId: number) =>
            fetchAPI<void>(`/api/github/installations/${installationId}`, { method: "DELETE" }),
    },

    live: {
        ingest: (projectId: string, requests: LiveCapturedRequest[]) =>
            fetchAPI<{ message: string; count: string }>("/api/live/ingest", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId, requests }),
            }),
        getRequests: (projectId: string) =>
            fetchAPI<LiveCapturedRequest[]>(`/api/live/requests?project_id=${projectId}`),
        infer: (projectId: string) =>
            fetchAPI<{ message: string; count: number }>("/api/live/infer", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId }),
            }),
        clear: (projectId: string) =>
            fetchAPI<{ message: string }>("/api/live/clear", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId }),
            }),
        streamUrl: async (projectId: string) => {
            const token = await getAuthToken();
            const params = new URLSearchParams({ project_id: projectId });
            if (token) params.set("token", token);
            return `${API_BASE}/api/live/stream?${params}`;
        },
        startCapture: (projectId: string) =>
            fetchAPI<{ message: string }>("/api/live/capture/start", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId }),
            }),
        stopCapture: () =>
            fetchAPI<{ message: string }>("/api/live/capture/stop", {
                method: "POST",
                body: JSON.stringify({}),
            }),
        getSources: (projectId: string) =>
            fetchAPI<string[]>(`/api/live/sources?project_id=${projectId}`),
        liveDiff: (projectId: string, sourceA: string, sourceB: string) =>
            fetchAPI<LiveDiffResponse>("/api/live/diff", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId, source_a: sourceA, source_b: sourceB }),
            }),
        liveSchemas: (projectId: string, source: string) =>
            fetchAPI<SchemaIR[]>(`/api/live/schemas?project_id=${projectId}&source=${encodeURIComponent(source)}`),
        configureProxy: (projectId: string, label: string, targetUrl: string) =>
            fetchAPI<{ message: string; proxy_url: string }>("/api/live/proxy/configure", {
                method: "POST",
                body: JSON.stringify({ project_id: projectId, label, target_url: targetUrl }),
            }),
        proxyBaseUrl: (projectId: string, label: string) =>
            `${API_BASE}/api/live/proxy/${projectId}/${label}`,
    },
};
