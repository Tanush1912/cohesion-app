"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface HeaderProps {
    title: React.ReactNode;
    description?: string;
    breadcrumbs?: BreadcrumbItem[];
    actions?: React.ReactNode;
}

export function Header({ title, description, breadcrumbs, actions }: HeaderProps) {
    return (
        <header className="h-[76px] border-b border-white/10 bg-[oklch(0.12_0_0)] sticky top-0 z-40 flex items-center">
            <div className="px-6 py-4 w-full">
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav className="flex items-center gap-1 text-xs mb-2">
                        {breadcrumbs.map((item, index) => (
                            <span key={index} className="flex items-center gap-1">
                                {index > 0 && <ChevronRight className="w-3 h-3 text-white/30" />}
                                {item.href ? (
                                    <Link
                                        href={item.href}
                                        className="text-white/40 hover:text-white transition-colors"
                                    >
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span className="text-white/60">{item.label}</span>
                                )}
                            </span>
                        ))}
                    </nav>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-white">{title}</h1>
                        {description && (
                            <p className="text-xs text-white/40 mt-0.5">{description}</p>
                        )}
                    </div>

                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                </div>
            </div>
        </header>
    );
}
