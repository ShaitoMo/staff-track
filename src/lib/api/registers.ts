import { request } from "@/lib/api-client";
import type { CreateRegisterInput, UpdateRegisterInput } from "@/types/register";

export async function createRegister(input: CreateRegisterInput): Promise<void> {
    await request("/api/registers", { method: "POST", json: input });
}

export async function updateRegister(registerId: number, input: UpdateRegisterInput): Promise<void> {
    await request(`/api/registers/${registerId}`, { method: "PATCH", json: input });
}
