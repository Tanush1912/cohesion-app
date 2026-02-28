"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = onOpenChange ?? setUncontrolledOpen;

    return (
        <DialogContext.Provider value={{ open, setOpen }}>
            {children}
        </DialogContext.Provider>
    );
}

export function DialogTrigger({ children, className }: { children: ReactNode; className?: string }) {
    const context = useContext(DialogContext);
    if (!context) throw new Error("DialogTrigger must be used within Dialog");

    return (
        <div onClick={() => context.setOpen(true)} className={cn("cursor-pointer", className)}>
            {children}
        </div>
    );
}

export function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
    const context = useContext(DialogContext);
    if (!context) throw new Error("DialogContent must be used within Dialog");

    return (
        <AnimatePresence>
            {context.open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => context.setOpen(false)}
                        className="fixed inset-0 bg-black/70 z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
                            "w-full max-w-md",
                            "bg-[oklch(0.14_0_0)] border border-white/20 rounded-lg shadow-lg",
                            className
                        )}
                    >
                        <button
                            onClick={() => context.setOpen(false)}
                            className="absolute top-3 right-3 p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        {children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("px-4 pt-4 pb-2", className)}>
            {children}
        </div>
    );
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <h2 className={cn("text-base font-semibold text-white", className)}>
            {children}
        </h2>
    );
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={cn("text-sm text-white/50 mt-0.5", className)}>
            {children}
        </p>
    );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("px-4 pb-4 pt-3 flex justify-end gap-2", className)}>
            {children}
        </div>
    );
}
