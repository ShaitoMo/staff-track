import { NextResponse } from "next/server";
import { TaskService } from "@/services/task-service";

export async function GET() {
    const tasks = await TaskService.getAllTasks();
    return NextResponse.json(tasks);
}
