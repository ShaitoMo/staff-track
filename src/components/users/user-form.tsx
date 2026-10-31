"use client";

import { useState, useTransition, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
import { FormAlerts, FormCard, FormFooter, FormSection } from "@/components/layout/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n/client";
import { ApiError } from "@/lib/api-client";
import { createUser, linkUserBranch, unlinkUserBranch, updateUser } from "@/lib/api/users";
import { BranchLinkInput, diffBranchLinks } from "@/lib/branch-link-diff";
import { isUserFormValid, UserFormErrors, validateUserForm } from "@/lib/user-form-validation";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";
import type { UpdateUserInput } from "@/types/user";

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
    const [pending, startTransition] = useTransition();
    const t = useT();

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

    async function applyBranchDiff(userIdForLinks: number): Promise<{ branchId: number; message: string }[]> {
        const diff = diffBranchLinks(initialValues?.branchLinks ?? [], selectedBranchLinks());
        const warnings: { branchId: number; message: string }[] = [];

        const removeIds = [...diff.toRemove, ...diff.toUpdate.map((link) => link.branchId)];
        const removeResults = await Promise.allSettled(
            removeIds.map((branchId) => unlinkUserBranch(userIdForLinks, branchId)),
        );
        removeResults.forEach((result, index) => {
            if (result.status === "rejected") {
                const branchName = branches.find((b) => b.branchId === removeIds[index])?.name ?? t.users.fallbackBranch(removeIds[index]);
                warnings.push({ branchId: removeIds[index], message: t.users.couldNotRemove(branchName) });
            }
        });

        const addLinks = [...diff.toAdd, ...diff.toUpdate];
        const addResults = await Promise.allSettled(
            addLinks.map((link) => linkUserBranch({ userId: userIdForLinks, ...link })),
        );
        addResults.forEach((result, index) => {
            if (result.status === "fulfilled") return;
            const branchName = branches.find((b) => b.branchId === addLinks[index].branchId)?.name ?? t.users.fallbackBranch(addLinks[index].branchId);
            const reason = result.reason instanceof ApiError ? result.reason.message : null;
            warnings.push({ branchId: addLinks[index].branchId, message: t.users.couldNotLink(branchName, reason) });
        });

        return warnings;
    }

    function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);
        setBranchWarnings([]);

        const validationErrors = validateUserForm(
            { name, phone, password, roleId },
            { requirePassword: mode === "create" },
            t.users.errors,
        );
        setErrors(validationErrors);
        if (!isUserFormValid(validationErrors)) return;

        startTransition(async () => {
            try {
                if (mode === "create") {
                    const created = await createUser({ name, phone, password, roleId: roleId! });
                    const warnings = await applyBranchDiff(created.userId);
                    if (warnings.length > 0) {
                        // The user now exists, so staying on the create form would make a retry
                        // re-create them. The edit page loads the links that did go through.
                        const failedIds = [...new Set(warnings.map((warning) => warning.branchId))].join(",");
                        router.replace(`/users/${created.userId}/edit?branch_warning=${failedIds}`);
                        return;
                    }

                    router.push("/users");
                    router.refresh();
                    return;
                }

                // Edit mode.
                const patch: UpdateUserInput = {};
                if (name !== initialValues?.name) patch.name = name;
                if (phone !== initialValues?.phone) patch.phone = phone;
                if (canEditRoleAndStatus && roleId !== initialValues?.roleId) patch.roleId = roleId ?? undefined;
                if (canEditRoleAndStatus && isActive !== initialValues?.isActive) patch.isActive = isActive;

                if (Object.keys(patch).length > 0) {
                    await updateUser(userId!, patch);
                }

                const warnings = await applyBranchDiff(userId!);
                if (warnings.length > 0) {
                    setBranchWarnings(warnings.map((warning) => warning.message));
                    return;
                }

                router.push("/users");
                router.refresh();
            } catch (error) {
                setSubmitError(error instanceof ApiError ? error.message : t.common.somethingWentWrong);
            }
        });
    }

    return (
        <FormCard onSubmit={handleSubmit} className="max-w-5xl">
            {submitError || branchWarnings.length > 0 ? (
                <FormAlerts>
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
                                {t.users.savedButBranches}
                                <ul className="ms-4 list-disc">
                                    {branchWarnings.map((warning) => (
                                        <li key={warning}>{warning}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}
                </FormAlerts>
            ) : null}

            <FormSection legend={t.users.person} className="sm:grid-cols-2 lg:grid-cols-3">
                <Field data-invalid={!!errors.name || undefined}>
                    <FieldLabel htmlFor="name">{t.setup.name}</FieldLabel>
                    <Input id="name" value={name} disabled={pending} onChange={(e) => setName(e.target.value)} />
                    <FieldError>{errors.name}</FieldError>
                </Field>

                <Field data-invalid={!!errors.phone || undefined}>
                    <FieldLabel htmlFor="phone">{t.users.phone}</FieldLabel>
                    <Input id="phone" type="tel" dir="ltr" autoComplete="off" value={phone} disabled={pending} onChange={(e) => setPhone(e.target.value)} />
                    <FieldError>{errors.phone}</FieldError>
                </Field>

                {mode === "create" && (
                    <Field data-invalid={!!errors.password || undefined}>
                        <FieldLabel htmlFor="password">{t.users.password}</FieldLabel>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            disabled={pending}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <FieldError>{errors.password}</FieldError>
                    </Field>
                )}
            </FormSection>

            <FormSection legend={t.users.access} className="sm:grid-cols-2 lg:grid-cols-3">
                <Field data-invalid={!!errors.roleId || undefined}>
                    <FieldLabel htmlFor="role">{t.users.role}</FieldLabel>
                    <Select
                        value={roleId !== null ? String(roleId) : ""}
                        onValueChange={(value) => setRoleId(Number(value))}
                        disabled={pending || (mode === "edit" && !canEditRoleAndStatus)}
                    >
                        <SelectTrigger id="role" className="w-full">
                            <SelectValue placeholder={t.users.selectRole}>
                                {(value: string) => {
                                    const name = roles.find((role) => String(role.roleId) === value)?.name;
                                    return name !== undefined ? <span className="capitalize">{name}</span> : t.users.selectRole;
                                }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((role) => (
                                <SelectItem key={role.roleId} value={String(role.roleId)} className="capitalize">
                                    {role.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError>{errors.roleId}</FieldError>
                </Field>

                {mode === "edit" && (
                    <Field orientation="horizontal" className="col-span-full">
                        <Checkbox
                            id="isActive"
                            checked={isActive}
                            disabled={pending || !canEditRoleAndStatus}
                            onCheckedChange={(checked) => setIsActive(checked === true)}
                        />
                        <FieldLabel htmlFor="isActive" className="font-normal">{t.setup.active}</FieldLabel>
                    </Field>
                )}
            </FormSection>

            {/* a branch's machine ID sits on its own row, beside it, once the branch is ticked */}
            <FormSection legend={t.users.branches} className="gap-y-3">
                {branches.map((branch) => {
                    const selection = branchSelections[branch.branchId];
                    return (
                        <div key={branch.branchId} className="grid min-h-8 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,18rem)]">
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
                                    aria-label={t.users.machineIdAt(branch.name)}
                                    placeholder={t.users.machineIdPlaceholder}
                                    value={selection.machineEmployeeId}
                                    disabled={pending}
                                    onChange={(e) => setMachineEmployeeId(branch.branchId, e.target.value)}
                                    className="ms-6 w-auto sm:ms-0"
                                />
                            )}
                        </div>
                    );
                })}
            </FormSection>

            <FormFooter>
                <Button type="submit" disabled={pending}>
                    {pending && <Spinner data-icon="inline-start" />}
                    {mode === "create" ? t.users.createUser : t.setup.saveChanges}
                </Button>
            </FormFooter>
        </FormCard>
    );
}
