"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Layers, FolderKanban, Activity, Settings, PanelLeftClose, PanelLeft, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const navItems = [
    { href: "/", label: "Dashboard", icon: FolderKanban },
    { href: "/live", label: "Live", icon: Activity },
    { href: "/docs", label: "Docs", icon: BookOpen },
    { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const collapsed = useAppStore((s) => s.sidebarCollapsed);
    const toggleSidebar = useAppStore((s) => s.toggleSidebar);

    // Restore persisted sidebar state after hydration
    useEffect(() => {
        const stored = localStorage.getItem("cohesion-sidebar-collapsed");
        if (stored === "true") {
            useAppStore.setState({ sidebarCollapsed: true });
        }
    }, []);

    return (
        <aside
            className={cn(
                "sticky top-0 h-screen bg-[oklch(0.14_0_0)] border-r border-white/10 flex flex-col transition-all duration-200 overflow-hidden shrink-0",
                collapsed ? "w-14" : "w-56"
            )}
        >
            <div
                className={cn(
                    "group h-[76px] border-b border-white/10 flex items-center justify-between",
                    collapsed ? "px-2 py-3" : "px-6 py-4"
                )}
            >
                <Link
                    href="/"
                    className="flex items-center gap-2"
                    title={collapsed ? "Cohesion" : undefined}
                >
                    <div
                        className={cn(
                            "rounded border-2 border-white flex items-center justify-center shrink-0",
                            collapsed ? "w-7 h-7" : "w-8 h-8"
                        )}
                    >
                        <Layers className={cn("text-white", collapsed ? "w-3.5 h-3.5" : "w-4 h-4")} />
                    </div>
                    {!collapsed && (
                        <span className="text-base font-semibold text-white tracking-tight">
                            Cohesion
                        </span>
                    )}
                </Link>
                <button
                    onClick={toggleSidebar}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    className={cn(
                        "p-1.5 rounded text-white/40 hover:text-white hover:bg-white/5 transition-all duration-150 shrink-0",
                        collapsed ? "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 ml-auto" : ""
                    )}
                >
                    {collapsed ? (
                        <PanelLeft className="w-4 h-4" />
                    ) : (
                        <PanelLeftClose className="w-4 h-4" />
                    )}
                </button>
            </div>

            <nav className="flex-1 p-2">
                <ul className="space-y-0.5">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    title={collapsed ? item.label : undefined}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded",
                                        collapsed && "justify-center px-2",
                                        isActive
                                            ? "border-l-2 border-white bg-white/5 text-white font-medium"
                                            : "text-white/50 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    {!collapsed && item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className={cn(
                "border-t border-white/10 flex items-center",
                collapsed ? "justify-center p-2" : "px-4 py-3"
            )}>
                <UserButton
                    afterSignOutUrl="/sign-in"
                    appearance={{
                        elements: {
                            avatarBox: "w-7 h-7",
                        },
                    }}
                />
            </div>
        </aside>
    );
}
