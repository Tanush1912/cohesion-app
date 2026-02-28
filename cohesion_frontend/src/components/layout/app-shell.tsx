"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "sonner";

const AUTH_ROUTES = ["/sign-in", "/sign-up"];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAuthPage = AUTH_ROUTES.some((r) => pathname.startsWith(r));

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <>
            <div className="flex min-h-screen bg-[#0a0a0f]">
                <Sidebar />
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
            <Toaster
                theme="dark"
                position="bottom-right"
                toastOptions={{
                    style: {
                        background: "#0a0a0a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "12px",
                    },
                }}
            />
        </>
    );
}
