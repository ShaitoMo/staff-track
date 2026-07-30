import { CreateUserInput, SafeUser } from "@/types/user";
import { UserRepository } from "@/repository/user-repository";

export class UserService {
    static async createUser(data: CreateUserInput): Promise<SafeUser> {
        const user = await UserRepository.createUser(data);
        return user;
    }
}
