import { TasksRepository } from '../repository/tasks-repository';
import { Task } from '../types/task';
export class TaskService {

    static async getAllTasks(): Promise<Task[]> {
        return TasksRepository.getAllTasks();
    }
}
    