import { request } from "@/lib/api-client";
import type { CreateRoleInput } from "@/types/role";

export async function createRole(input: CreateRoleInput): Promise<void> {
    await request("/api/roles", { method: "POST", json: input });
}
