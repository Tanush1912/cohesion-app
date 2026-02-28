function waitForClerk(timeoutMs = 5000): Promise<any> {
    return new Promise((resolve) => {
        const clerk = (window as any).Clerk;
        if (clerk?.loaded) {
            resolve(clerk);
            return;
        }

        const start = Date.now();
        const interval = setInterval(() => {
            const c = (window as any).Clerk;
            if (c?.loaded) {
                clearInterval(interval);
                resolve(c);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                resolve(c ?? null);
            }
        }, 50);
    });
}

export async function getAuthToken(forceRefresh = false): Promise<string | null> {
    if (typeof window === "undefined") return null;

    try {
        const clerk = await waitForClerk();
        if (clerk?.session) {
            const token = await clerk.session.getToken(
                forceRefresh ? { skipCache: true } : undefined,
            );
            if (typeof token === "string" && token.split(".").length === 3) {
                return token;
            }
        }
    } catch {
    }
    return null;
}
