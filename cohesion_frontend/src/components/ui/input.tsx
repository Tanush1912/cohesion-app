"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { }

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type = "text", ...props }, ref) => {
        return (
            <input
                ref={ref}
                type={type}
                className={cn(
                    "w-full h-9 px-3 bg-[oklch(0.12_0_0)] border border-white/20 rounded-lg",
                    "text-sm text-white placeholder:text-white/40",
                    "focus:outline-none focus:border-white/40",
                    "transition-colors",
                    className
                )}
                {...props}
            />
        );
    }
);

Input.displayName = "Input";

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> { }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    "w-full min-h-[80px] px-3 py-2 bg-[oklch(0.12_0_0)] border border-white/20 rounded-lg",
                    "text-sm text-white placeholder:text-white/40 resize-none",
                    "focus:outline-none focus:border-white/40",
                    "transition-colors",
                    className
                )}
                {...props}
            />
        );
    }
);

Textarea.displayName = "Textarea";
