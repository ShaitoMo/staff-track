import { request } from "@/lib/api-client";
import type { CreateTaskBody } from "@/types/task";

export async function createTask(input: CreateTaskBody): Promise<void> {
    await request("/api/tasks", { method: "POST", json: input });
}
