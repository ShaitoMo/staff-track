import { TasksRepository } from '../repository/tasks-repository';
import { Task, UpdateTaskInput } from '../types/task';
export class TaskService {

    static async getAllTasks(): Promise<Task[]> {
        return TasksRepository.getAllTasks();
    }

    static async getTaskById(taskId: number): Promise<Task | null> {
        return TasksRepository.getTaskById(taskId);
    }

    static async updateTask(taskId: number, data: UpdateTaskInput): Promise<Task> {
        return TasksRepository.updateTask(taskId, data);
    }
}
    