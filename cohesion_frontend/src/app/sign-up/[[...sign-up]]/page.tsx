"use client";

import { useRef, useEffect } from "react";
import { SignUp } from "@clerk/nextjs";
import gsap from "gsap";
import { MaskContainer } from "@/components/ui/svg-mask-effect";
import { RevealContent } from "@/components/auth/reveal-content";

function SignUpOverlay() {
    const lettersRef = useRef<HTMLSpanElement[]>([]);
    const taglineRef = useRef<HTMLParagraphElement>(null);
    const formRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const tl = gsap.timeline();

        lettersRef.current.forEach((letter, i) => {
            if (letter) {
                tl.fromTo(
                    letter,
                    { opacity: 0, y: 40, rotateX: -90 },
                    { opacity: 1, y: 0, rotateX: 0, duration: 0.5, ease: "back.out(2)" },
                    0.3 + i * 0.06
                );
            }
        });

        if (taglineRef.current) {
            tl.fromTo(
                taglineRef.current,
                { opacity: 0, y: 10 },
                { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
                0.9
            );
        }

        if (formRef.current) {
            tl.fromTo(
                formRef.current,
                { opacity: 0, y: 30, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "power3.out" },
                1.1
            );
        }

        return () => { tl.kill(); };
    }, []);

    const brandName = "Cohesion";

    return (
        <div className="flex flex-col items-center">
            <div className="flex flex-col items-center mb-10">
                <p className="text-xs text-white/30 tracking-widest uppercase mb-4">
                    Frontend ←→ Backend alignment, visualized
                </p>
                <h1
                    className="text-5xl font-bold tracking-tight text-white mb-3"
                    style={{ perspective: "600px" }}
                >
                    {brandName.split("").map((char, i) => (
                        <span
                            key={i}
                            ref={(el) => { if (el) lettersRef.current[i] = el; }}
                            className="inline-block opacity-0"
                            style={{ transformOrigin: "bottom center" }}
                        >
                            {char}
                        </span>
                    ))}
                </h1>
                <p ref={taglineRef} className="text-sm text-white/55 tracking-wide opacity-0">
                    Connect your codebase to get started
                </p>
            </div>

            <div ref={formRef} className="opacity-0 pointer-events-auto">
                <SignUp
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            cardBox:
                                "bg-[oklch(0.13_0.005_260)] border border-white/[0.08] shadow-[0_0_40px_rgba(255,255,255,0.03),0_20px_60px_rgba(0,0,0,0.5)] rounded-2xl",
                            card: "bg-transparent shadow-none",
                            headerTitle: "hidden",
                            headerSubtitle: "hidden",
                            socialButtonsBlockButton:
                                "bg-white/95 border-0 text-[#0a0a0f] font-medium hover:bg-white transition-all duration-150 shadow-sm",
                            socialButtonsBlockButtonText: "text-[#0a0a0f] font-medium",
                            socialButtonsBlockButtonArrow: "text-[#0a0a0f]",
                            formFieldLabel: "text-white/60",
                            formFieldInput: "bg-[oklch(0.12_0_0)] border-white/10 text-white",
                            footerActionLink: "text-white/60 hover:text-white",
                            dividerLine: "bg-white/10",
                            dividerText: "text-white/30",
                            formButtonPrimary: "bg-white text-[#0a0a0f] hover:bg-white/90 font-medium",
                            footer: "bg-transparent",
                            footerAction: "text-white/40",
                            socialButtonsProviderIcon__github: "invert",
                        },
                    }}
                />
            </div>
        </div>
    );
}

export default function SignUpPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0f] overflow-hidden">
            <MaskContainer
                key="sign-up-mask"
                revealText={
                    <div className="relative h-full w-full">
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundImage: `
                                    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                                    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                                `,
                                backgroundSize: "60px 60px",
                            }}
                        />
                    </div>
                }
                className="h-screen bg-[#0a0a0f]"
                size={10}
                revealSize={500}
                overlayContent={<SignUpOverlay />}
            >
                <RevealContent />
            </MaskContainer>
        </div>
    );
}
