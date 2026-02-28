"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useAppStore } from "@/stores/app-store";

interface CreateProjectDialogProps {
    externalOpen?: boolean;
    onExternalOpenChange?: (open: boolean) => void;
}

export function CreateProjectDialog({ externalOpen, onExternalOpenChange }: CreateProjectDialogProps = {}) {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = externalOpen ?? internalOpen;
    const setOpen = onExternalOpenChange ?? setInternalOpen;
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { createProject } = useAppStore();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            const project = await createProject(name, description);
            setOpen(false);
            setName("");
            setDescription("");
            router.push(`/projects/${project.id}`);
        } catch {
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
                <Button size="md">
                    <Plus className="w-4 h-4" />
                    New Project
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>
                            Add a new project to start analyzing API contracts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                                Project Name
                            </label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="My API"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                                Description (optional)
                            </label>
                            <Textarea
                                value={description}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                                placeholder="Brief description of your API..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim() || isSubmitting}>
                            {isSubmitting ? "Creating..." : "Create Project"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
