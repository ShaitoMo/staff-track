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
import { ApiError } from "@/lib/api-client";
import { createTask, updateTask } from "@/lib/api/tasks";
import { WEEKDAY_LABELS } from "@/lib/recurrence-label";
import {
    AssigneeCandidate,
    assigneeOptionsForBranch,
    AssigneeKind,
    buildCreateTaskBody,
    BranchLink,
    buildUpdateTaskBody,
    EditableTaskState,
    hasTaskChanges,
    isTaskFormValid,
    Schedule,
    TaskFormErrors,
    validateTaskForm,
    validateTaskUpdate,
    Weekday,
    WEEKDAYS,
} from "@/lib/task-form-validation";
import { Branch } from "@/types/branch";
import { Role } from "@/types/role";

interface TaskFormProps {
    branches: Branch[];
    roles: Role[];
    users: AssigneeCandidate[];
    userBranches: BranchLink[];
    mode?: "create" | "edit";
    taskId?: number;
    initialValues?: EditableTaskState;
}

const ASSIGNEE_KINDS: { value: AssigneeKind; label: string }[] = [
    { value: "person", label: "A person" },
    { value: "role", label: "A role" },
];

const SCHEDULES: { value: Schedule; label: string }[] = [
    { value: "one_off", label: "Once" },
    { value: "daily", label: "Every day" },
    { value: "weekly", label: "Certain weekdays" },
];

export function TaskForm({ branches, roles, users, userBranches, mode = "create", taskId, initialValues }: TaskFormProps) {
    const router = useRouter();
    const isEdit = mode === "edit";
    const [title, setTitle] = useState(initialValues?.title ?? "");
    const [description, setDescription] = useState(initialValues?.description ?? "");
    const [branchId, setBranchId] = useState<number | null>(initialValues?.branchId ?? null);
    const [assigneeKind, setAssigneeKind] = useState<AssigneeKind>(initialValues?.assigneeKind ?? "person");
    const [assignedTo, setAssignedTo] = useState<number | null>(initialValues?.assignedTo ?? null);
    const [roleId, setRoleId] = useState<number | null>(initialValues?.roleId ?? null);
    const [schedule, setSchedule] = useState<Schedule>(initialValues?.schedule ?? "one_off");
    const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? "");
    const [weekdays, setWeekdays] = useState<Weekday[]>(initialValues?.weekdays ?? []);
    const [active, setActive] = useState(initialValues?.active ?? true);
    const [errors, setErrors] = useState<TaskFormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const people = assigneeOptionsForBranch(branchId, users, userBranches);
    // A task's kind is fixed once created: a one-off can't start repeating, nor a recurring one stop.
    const wasOneOff = isEdit && initialValues?.schedule === "one_off";
    const scheduleOptions = isEdit ? SCHEDULES.filter((option) => option.value !== "one_off") : SCHEDULES;

    function handleBranchChange(value: string | null) {
        if (value === null) return;
        setBranchId(Number(value));
        setAssignedTo(null);
    }

    function toggleWeekday(day: Weekday, checked: boolean) {
        setWeekdays((current) => (checked ? [...current, day] : current.filter((d) => d !== day)));
    }

    async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitError(null);

        const input = { title, description, branchId, assigneeKind, assignedTo, roleId, schedule, dueDate, weekdays };
        const validationErrors = isEdit
            ? validateTaskUpdate(initialValues!, { ...input, active })
            : validateTaskForm(input);
        setErrors(validationErrors);
        if (!isTaskFormValid(validationErrors)) return;

        setPending(true);
        try {
            if (isEdit) {
                const body = buildUpdateTaskBody(initialValues!, { ...input, active });
                if (hasTaskChanges(body)) {
                    await updateTask(taskId!, body);
                }
            } else {
                await createTask(buildCreateTaskBody(input));
            }

            router.push("/tasks");
            router.refresh();
        } catch (error) {
            setSubmitError(error instanceof ApiError ? error.message : "Something went wrong.");
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} noValidate className="flex max-w-lg flex-col gap-6">
            <FieldGroup>
                {submitError ? (
                    <Alert variant="destructive">
                        <AlertCircleIcon />
                        <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                ) : null}

                <Field data-invalid={!!errors.title || undefined}>
                    <FieldLabel htmlFor="title">Title</FieldLabel>
                    <Input id="title" value={title} disabled={pending} onChange={(e) => setTitle(e.target.value)} />
                    <FieldError>{errors.title}</FieldError>
                </Field>

                <Field>
                    <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
                    <Input id="description" value={description} disabled={pending} onChange={(e) => setDescription(e.target.value)} />
                </Field>

                <Field data-invalid={!!errors.branchId || undefined}>
                    <FieldLabel htmlFor="branch">Branch</FieldLabel>
                    <Select value={branchId !== null ? String(branchId) : ""} onValueChange={handleBranchChange} disabled={pending || isEdit}>
                        <SelectTrigger id="branch" className="w-full">
                            <SelectValue placeholder="Select a branch">
                                {(value: string) => branches.find((branch) => String(branch.branchId) === value)?.name ?? "Select a branch"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {branches.map((branch) => (
                                <SelectItem key={branch.branchId} value={String(branch.branchId)}>
                                    {branch.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FieldError>{errors.branchId}</FieldError>
                </Field>

                <Field>
                    <FieldLabel htmlFor="assignee-kind">Assign to</FieldLabel>
                    <Select value={assigneeKind} onValueChange={(value) => setAssigneeKind(value as AssigneeKind)} disabled={pending}>
                        <SelectTrigger id="assignee-kind" className="w-full">
                            <SelectValue>
                                {(value: string) => ASSIGNEE_KINDS.find((kind) => kind.value === value)?.label}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {ASSIGNEE_KINDS.map((kind) => (
                                <SelectItem key={kind.value} value={kind.value}>
                                    {kind.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field data-invalid={!!errors.assignee || undefined}>
                    {assigneeKind === "person" ? (
                        <>
                            <FieldLabel htmlFor="assigned-to">Person</FieldLabel>
                            <Select
                                value={assignedTo !== null ? String(assignedTo) : ""}
                                onValueChange={(value) => setAssignedTo(Number(value))}
                                disabled={pending || branchId === null}
                            >
                                <SelectTrigger id="assigned-to" className="w-full">
                                    <SelectValue placeholder={branchId === null ? "Choose a branch first" : "Select a person"}>
                                        {(value: string) => people.find((person) => String(person.userId) === value)?.name ?? (branchId === null ? "Choose a branch first" : "Select a person")}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {people.map((person) => (
                                        <SelectItem key={person.userId} value={String(person.userId)}>
                                            {person.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    ) : (
                        <>
                            <FieldLabel htmlFor="role">Role</FieldLabel>
                            <Select
                                value={roleId !== null ? String(roleId) : ""}
                                onValueChange={(value) => setRoleId(Number(value))}
                                disabled={pending}
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
                        </>
                    )}
                    <FieldError>{errors.assignee}</FieldError>
                </Field>

                {wasOneOff ? (
                    <Field>
                        <FieldLabel>Repeats</FieldLabel>
                        <p className="text-sm text-muted-foreground">Once. A one-off task&apos;s date can&apos;t be changed.</p>
                    </Field>
                ) : (
                    <Field>
                        <FieldLabel htmlFor="schedule">Repeats</FieldLabel>
                        <Select value={schedule} onValueChange={(value) => setSchedule(value as Schedule)} disabled={pending}>
                            <SelectTrigger id="schedule" className="w-full">
                                <SelectValue>
                                    {(value: string) => SCHEDULES.find((option) => option.value === value)?.label}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {scheduleOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                )}

                {!isEdit && schedule === "one_off" ? (
                    <Field data-invalid={!!errors.dueDate || undefined}>
                        <FieldLabel htmlFor="due-date">Due date</FieldLabel>
                        <Input id="due-date" type="date" value={dueDate} disabled={pending} onChange={(e) => setDueDate(e.target.value)} />
                        <FieldError>{errors.dueDate}</FieldError>
                    </Field>
                ) : null}

                {schedule === "weekly" ? (
                    <FieldSet data-invalid={!!errors.weekdays || undefined}>
                        <FieldLegend variant="label">Weekdays</FieldLegend>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {WEEKDAYS.map((day) => (
                                <Field key={day} orientation="horizontal" className="w-auto">
                                    <Checkbox
                                        id={`weekday-${day}`}
                                        checked={weekdays.includes(day)}
                                        disabled={pending}
                                        onCheckedChange={(checked) => toggleWeekday(day, checked === true)}
                                    />
                                    <FieldLabel htmlFor={`weekday-${day}`} className="font-normal">
                                        {WEEKDAY_LABELS[day]}
                                    </FieldLabel>
                                </Field>
                            ))}
                        </div>
                        <FieldError>{errors.weekdays}</FieldError>
                    </FieldSet>
                ) : null}

                {isEdit ? (
                    <Field orientation="horizontal">
                        <Checkbox
                            id="active"
                            checked={active}
                            disabled={pending}
                            onCheckedChange={(checked) => setActive(checked === true)}
                        />
                        <FieldLabel htmlFor="active" className="font-normal">Active</FieldLabel>
                    </Field>
                ) : null}

                <Button type="submit" disabled={pending} className="w-fit">
                    {pending ? <Spinner data-icon="inline-start" /> : null}
                    {isEdit ? "Save changes" : "Create task"}
                </Button>
            </FieldGroup>
        </form>
    );
}
