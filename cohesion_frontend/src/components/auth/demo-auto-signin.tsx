"use client";

import { useEffect, useRef } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export function DemoAutoSignIn() {
    const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
    const { isSignedIn, isLoaded: authLoaded } = useAuth();
    const searchParams = useSearchParams();
    const attempted = useRef(false);

    const isDemo = searchParams.get("demo") === "true";

    useEffect(() => {
        if (!isDemo || !signInLoaded || !authLoaded || attempted.current) return;

        if (isSignedIn) {
            const url = new URL(window.location.href);
            url.searchParams.delete("demo");
            window.location.replace(url.pathname + url.search || "/");
            return;
        }

        attempted.current = true;

        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/demo/token`);
                if (!res.ok) throw new Error("Failed to get demo token");
                const { ticket } = await res.json();

                const result = await signIn!.create({
                    strategy: "ticket",
                    ticket,
                });

                if (result.status === "complete" && result.createdSessionId) {
                    await setActive!({ session: result.createdSessionId });
                    const url = new URL(window.location.href);
                    url.searchParams.delete("demo");
                    window.location.replace(url.pathname || "/");
                }
            } catch (err) {
                console.error("[demo] auto sign-in failed:", err);
                attempted.current = false;
            }
        })();
    }, [isDemo, signInLoaded, authLoaded, isSignedIn, signIn, setActive]);

    if (!isDemo) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0f]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-white/50 font-mono">
                    Signing into demo account&hellip;
                </p>
            </div>
        </div>
    );
}
