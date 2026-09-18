"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { BranchLinkInput, diffBranchLinks } from "@/lib/branch-link-diff";
import { isUserFormValid, UserFormErrors, validateUserForm } from "@/lib/user-form-validation";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";

interface UserFormProps {
    mode: "create" | "edit";
    userId?: number;
    roles: Role[];
    branches: Branch[];
    canEditRoleAndStatus: boolean;
    initialValues?: {
        name: string;
        phone: string;
        roleId: number;
        isActive: boolean;
        branchLinks: BranchLinkInput[];
    };
}

interface BranchSelection {
    selected: boolean;
    machineEmployeeId: string;
}

async function postJson<T = unknown>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const responseBody = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: responseBody as T };
    return { ok: false, error: typeof responseBody?.error === "string" ? responseBody.error : `Request to ${path} failed` };
}

export function UserForm({ mode, userId, roles, branches, canEditRoleAndStatus, initialValues }: UserFormProps) {
    const router = useRouter();
    const [name, setName] = useState(initialValues?.name ?? "");
    const [phone, setPhone] = useState(initialValues?.phone ?? "");
    const [password, setPassword] = useState("");
    const [roleId, setRoleId] = useState<number | null>(initialValues?.roleId ?? null);
    const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
    const [branchSelections, setBranchSelections] = useState<Record<number, BranchSelection>>(() => {
        const initial: Record<number, BranchSelection> = {};
        for (const link of initialValues?.branchLinks ?? []) {
            initial[link.branchId] = { selected: true, machineEmployeeId: link.machineEmployeeId ?? "" };
        }
        return initial;
    });

    const [errors, setErrors] = useState<UserFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [branchWarnings, setBranchWarnings] = useState<string[]>([]);
    const [pending, setPending] = useState(false);

    function toggleBranch(branchId: number, selected: boolean) {
        setBranchSelections((prev) => ({
            ...prev,
            [branchId]: { selected, machineEmployeeId: prev[branchId]?.machineEmployeeId ?? "" },
        }));
    }

    function setMachineEmployeeId(branchId: number, value: string) {
        setBranchSelections((prev) => ({
            ...prev,
            [branchId]: { selected: prev[branchId]?.selected ?? false, machineEmployeeId: value },
        }));
    }

    function selectedBranchLinks(): BranchLinkInput[] {
        return branches
            .filter((branch) => branchSelections[branch.branchId]?.selected)
            .map((branch) => ({
                branchId: branch.branchId,
                machineEmployeeId: branchSelections[branch.branchId]?.machineEmployeeId || undefined,
            }));
    }

    async function applyBranchDiff(userIdForLinks: number): Promise<string[]> {
        const diff = diffBranchLinks(initialValues?.branchLinks ?? [], selectedBranchLinks());
        const warnings: string[] = [];

        const removeIds = [...diff.toRemove, ...diff.toUpdate.map((link) => link.branchId)];
        const removeResults = await Promise.allSettled(
            removeIds.map((branchId) =>
                fetch(`/api/user-branches/${userIdForLinks}/${branchId}`, { method: "DELETE" }),
            ),
        );
        removeResults.forEach((result, index) => {
            if (result.status === "rejected" || !result.value.ok) {
                const branchName = branches.find((b) => b.branchId === removeIds[index])?.name ?? `branch ${removeIds[index]}`;
                warnings.push(`Could not remove ${branchName}.`);
            }
        });

        const addLinks = [...diff.toAdd, ...diff.toUpdate];
        const addResults = await Promise.allSettled(
            addLinks.map((link) => postJson("/api/user-branches", { userId: userIdForLinks, ...link })),
        );
        addResults.forEach((result, index) => {
            const branchName = branches.find((b) => b.branchId === addLinks[index].branchId)?.name ?? `branch ${addLinks[index].branchId}`;
            if (result.status === "rejected") {
                warnings.push(`Could not link ${branchName}.`);
            } else if (!result.value.ok) {
                warnings.push(`Could not link ${branchName}: ${result.value.error}`);
            }
        });

        return warnings;
    }

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);
        setBranchWarnings([]);

        const validationErrors = validateUserForm(
            { name, phone, password, roleId },
            { requirePassword: mode === "create" },
        );
        setErrors(validationErrors);
        if (!isUserFormValid(validationErrors)) return;

        setPending(true);
        try {
            if (mode === "create") {
                const created = await postJson<{ userId: number }>("/api/users", { name, phone, password, roleId });
                if (!created.ok) {
                    setSubmitError(created.error);
                    return;
                }

                const warnings = await applyBranchDiff(created.data.userId);
                if (warnings.length > 0) {
                    setBranchWarnings(warnings);
                    return;
                }

                router.push("/users");
                router.refresh();
                return;
            }

            // Edit mode.
            const patch: Record<string, unknown> = {};
            if (name !== initialValues?.name) patch.name = name;
            if (phone !== initialValues?.phone) patch.phone = phone;
            if (canEditRoleAndStatus && roleId !== initialValues?.roleId) patch.roleId = roleId;
            if (canEditRoleAndStatus && isActive !== initialValues?.isActive) patch.isActive = isActive;

            if (Object.keys(patch).length > 0) {
                const res = await fetch(`/api/users/${userId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => null);
                    setSubmitError(typeof body?.error === "string" ? body.error : "Failed to update user.");
                    return;
                }
            }

            const warnings = await applyBranchDiff(userId!);
            if (warnings.length > 0) {
                setBranchWarnings(warnings);
                return;
            }

            router.push("/users");
            router.refresh();
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex max-w-lg flex-col gap-6">
            <FieldGroup>
                {submitError && (
                    <Alert variant="destructive">
                        <AlertCircleIcon />
                        <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                )}
                {branchWarnings.length > 0 && (
                    <Alert variant="destructive">
                        <AlertCircleIcon />
                        <AlertDescription>
                            The user was saved, but some branch changes didn&apos;t go through:
                            <ul className="ml-4 list-disc">
                                {branchWarnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input id="name" value={name} disabled={pending} onChange={(e) => setName(e.target.value)} />
                    <FieldError>{errors.name}</FieldError>
                </Field>

                <Field data-invalid={!!errors.phone || undefined}>
                    <FieldLabel htmlFor="phone">Phone</FieldLabel>
                    <Input id="phone" type="tel" value={phone} disabled={pending} onChange={(e) => setPhone(e.target.value)} />
                    <FieldError>{errors.phone}</FieldError>
                </Field>

                {mode === "create" && (
                    <Field data-invalid={!!errors.password || undefined}>
                        <FieldLabel htmlFor="password">Password</FieldLabel>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            disabled={pending}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <FieldError>{errors.password}</FieldError>
                    </Field>
                )}

                <Field data-invalid={!!errors.roleId || undefined}>
                    <FieldLabel htmlFor="role">Role</FieldLabel>
                    <Select
                        value={roleId !== null ? String(roleId) : ""}
                        onValueChange={(value) => setRoleId(Number(value))}
                        disabled={pending || (mode === "edit" && !canEditRoleAndStatus)}
                    >
                        <SelectTrigger id="role" className="w-full">
                            <SelectValue placeholder="Select a role">
                                {(value: string) => roles.find((role) => String(role.roleId) === value)?.name ?? "Select a role"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((role) => (
                                <SelectItem key={role.roleId} value={String(role.roleId)}>
                                    {role.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError>{errors.roleId}</FieldError>
                </Field>

                {mode === "edit" && (
                    <Field orientation="horizontal">
                        <Checkbox
                            id="isActive"
                            checked={isActive}
                            disabled={pending || !canEditRoleAndStatus}
                            onCheckedChange={(checked) => setIsActive(checked === true)}
                        />
                        <FieldLabel htmlFor="isActive" className="font-normal">Active</FieldLabel>
                    </Field>
                )}

                <FieldSet>
                    <FieldLegend variant="label">Branches</FieldLegend>
                    <FieldGroup className="gap-3">
                        {branches.map((branch) => {
                            const selection = branchSelections[branch.branchId];
                            return (
                                <div key={branch.branchId} className="flex flex-col gap-2">
                                    <Field orientation="horizontal">
                                        <Checkbox
                                            id={`branch-${branch.branchId}`}
                                            checked={selection?.selected ?? false}
                                            disabled={pending}
                                            onCheckedChange={(checked) => toggleBranch(branch.branchId, checked === true)}
                                        />
                                        <FieldLabel htmlFor={`branch-${branch.branchId}`} className="font-normal">
                                            {branch.name}
                                        </FieldLabel>
                                    </Field>
                                    {selection?.selected && (
                                        <Input
                                            placeholder="Machine employee ID (optional)"
                                            value={selection.machineEmployeeId}
                                            disabled={pending}
                                            onChange={(e) => setMachineEmployeeId(branch.branchId, e.target.value)}
                                            className="ml-6 w-auto"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </FieldGroup>
                </FieldSet>

                <Button type="submit" disabled={pending} className="w-fit">
                    {pending && <Spinner data-icon="inline-start" />}
                    {mode === "create" ? "Create user" : "Save changes"}
                </Button>
            </FieldGroup>
        </form>
    );
}
