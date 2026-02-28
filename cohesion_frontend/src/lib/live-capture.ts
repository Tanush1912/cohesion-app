import { getAuthToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const STORAGE_KEY = "cohesion-live-capture-project";

interface CapturedCall {
    path: string;
    method: string;
    status_code: number;
    duration_ms: number;
    request_body?: Record<string, unknown>;
    response_body?: Record<string, unknown>;
    source: string;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let buffer: CapturedCall[] = [];

const FLUSH_INTERVAL_MS = 500;
const MAX_BUFFER_SIZE = 20;

function getActiveProjectId(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function shouldCapture(path: string): boolean {
    return !path.startsWith("/api/live/");
}

async function flush() {
    const projectId = getActiveProjectId();
    if (buffer.length === 0 || !projectId) return;

    const batch = buffer.splice(0);
    const token = await getAuthToken();

    try {
        await fetch(`${API_BASE}/api/live/ingest`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                project_id: projectId,
                requests: batch,
            }),
        });
    } catch {
        // Silently drop — capture is best-effort
    }
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
    }, FLUSH_INTERVAL_MS);
}

function enqueue(call: CapturedCall) {
    buffer.push(call);
    if (buffer.length >= MAX_BUFFER_SIZE) {
        flush();
    } else {
        scheduleFlush();
    }
}

export function enableFrontendCapture(projectId: string) {
    try {
        localStorage.setItem(STORAGE_KEY, projectId);
    } catch { /* SSR or storage full */ }
    buffer = [];
}

export function disableFrontendCapture() {
    // Flush remaining buffer before clearing state
    flush();
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* SSR */ }
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    buffer = [];
}

export function isFrontendCaptureActive(): boolean {
    return getActiveProjectId() !== null;
}

/**
 * Wraps a fetch call to capture its details for the live dual-source view.
 * Uses localStorage so capture works across all browser tabs — start capture
 * on the Live page, then browse in another tab and requests appear as "frontend" source.
 */
export async function captureAround(
    path: string,
    method: string,
    requestBody: unknown | undefined,
    doFetch: () => Promise<Response>,
): Promise<Response> {
    const projectId = getActiveProjectId();
    if (!projectId || !shouldCapture(path)) {
        return doFetch();
    }

    const start = performance.now();
    const response = await doFetch();
    const durationMs = performance.now() - start;

    // Clone the response so we can read the body without consuming it
    const cloned = response.clone();
    let responseBody: Record<string, unknown> | undefined;
    try {
        responseBody = await cloned.json();
    } catch {
        // Non-JSON response, skip body
    }

    let reqBody: Record<string, unknown> | undefined;
    if (requestBody && typeof requestBody === "object") {
        reqBody = requestBody as Record<string, unknown>;
    }

    enqueue({
        path,
        method: method.toUpperCase(),
        status_code: response.status,
        duration_ms: Math.round(durationMs),
        request_body: reqBody,
        response_body: responseBody,
        source: "frontend",
    });

    return response;
}
