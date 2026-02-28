import { create } from "zustand";
import { Project, Endpoint, DiffResult } from "@/lib/types";
import { api } from "@/lib/api";

interface AppState {
    projects: Project[];
    currentProject: Project | null;
    endpoints: Endpoint[];
    currentEndpoint: Endpoint | null;
    currentDiff: DiffResult | null;
    diffMap: Record<string, DiffResult>;
    diffMapProjectId: string | null;
    isLoading: boolean;
    error: string | null;
    sidebarCollapsed: boolean;

    fetchProjects: () => Promise<void>;
    fetchProject: (id: string) => Promise<void>;
    createProject: (name: string, description: string) => Promise<Project>;
    deleteProject: (id: string) => Promise<void>;
    fetchEndpoints: (projectId: string) => Promise<void>;
    fetchEndpoint: (id: string) => Promise<void>;
    computeDiff: (endpointId: string) => Promise<void>;
    fetchDiffsForProject: (projectId: string, endpoints: Endpoint[]) => Promise<void>;
    invalidateDiffMap: () => void;
    clearError: () => void;
    toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    projects: [],
    currentProject: null,
    endpoints: [],
    currentEndpoint: null,
    currentDiff: null,
    diffMap: {},
    diffMapProjectId: null,
    isLoading: false,
    error: null,
    sidebarCollapsed: false,

    fetchProjects: async () => {
        set({ isLoading: true, error: null });
        try {
            const projects = await api.projects.list();
            set({ projects, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    fetchProject: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const project = await api.projects.get(id);
            set({ currentProject: project, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    createProject: async (name: string, description: string) => {
        set({ isLoading: true, error: null });
        try {
            const project = await api.projects.create(name, description);
            set((state) => ({
                projects: [project, ...state.projects],
                isLoading: false,
            }));
            return project;
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
            throw e;
        }
    },

    deleteProject: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            await api.projects.delete(id);
            set((state) => ({
                projects: state.projects.filter((p) => p.id !== id),
                isLoading: false,
            }));
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    fetchEndpoints: async (projectId: string) => {
        set({ isLoading: true, error: null });
        try {
            const endpoints = await api.endpoints.list(projectId);
            set({ endpoints, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    fetchEndpoint: async (id: string) => {
        set({ isLoading: true, error: null, currentDiff: null });
        try {
            const endpoint = await api.endpoints.get(id);
            set({ currentEndpoint: endpoint, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    computeDiff: async (endpointId: string) => {
        set({ isLoading: true, error: null });
        try {
            const diff = await api.diff.compute(endpointId);
            set({ currentDiff: diff, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    fetchDiffsForProject: async (projectId: string, endpoints: Endpoint[]) => {
        // Skip if already cached for this project
        if (get().diffMapProjectId === projectId && Object.keys(get().diffMap).length > 0) {
            return;
        }

        const multiSource = endpoints.filter(
            (e) => e.schemas && e.schemas.length >= 2
        );
        if (multiSource.length === 0) return;

        const results: Record<string, DiffResult> = {};
        await Promise.allSettled(
            multiSource.map((ep) =>
                api.diff.compute(ep.id).then((diff) => {
                    results[ep.id] = diff;
                })
            )
        );
        set({ diffMap: results, diffMapProjectId: projectId });
    },

    invalidateDiffMap: () => set({ diffMap: {}, diffMapProjectId: null }),

    clearError: () => set({ error: null }),

    toggleSidebar: () => {
        const next = !get().sidebarCollapsed;
        localStorage.setItem("cohesion-sidebar-collapsed", String(next));
        set({ sidebarCollapsed: next });
    },
}));
