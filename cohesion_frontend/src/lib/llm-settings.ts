const API_KEY_STORAGE_KEY = "cohesion-llm-api-key";
const MODEL_STORAGE_KEY = "cohesion-llm-model";

export interface LLMSettings {
    apiKey: string | null;
    model: string | null;
}

export function getLLMSettings(): LLMSettings {
    if (typeof window === "undefined") {
        return { apiKey: null, model: null };
    }
    return {
        apiKey: localStorage.getItem(API_KEY_STORAGE_KEY),
        model: localStorage.getItem(MODEL_STORAGE_KEY),
    };
}

export function saveLLMSettings(apiKey: string, model: string): void {
    if (apiKey) {
        localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
    if (model) {
        localStorage.setItem(MODEL_STORAGE_KEY, model);
    } else {
        localStorage.removeItem(MODEL_STORAGE_KEY);
    }
}
