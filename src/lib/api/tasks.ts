import { request } from "@/lib/api-client";
import type { CreateTaskBody, UpdateTaskInput } from "@/types/task";

export async function createTask(input: CreateTaskBody): Promise<void> {
    await request("/api/tasks", { method: "POST", json: input });
}

export async function updateTask(taskId: number, input: UpdateTaskInput): Promise<void> {
    await request(`/api/tasks/${taskId}`, { method: "PATCH", json: input });
}
