import bcrypt from "bcrypt";
import { User, SafeUser, UpdateUserInput } from "@/types/user";
import { UserRepository } from "@/repository/user-repository";

const SALT_ROUNDS = 10;

export class UserService {
    static async createUser(data: User): Promise<SafeUser> {
        const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
        const user = await UserRepository.createUser({
            name: data.name,
            phone: data.phone,
            passwordHash,
            roleId: data.roleId,
        });
        return user;
    }
    static async getAllUsers(branchIds?: number[]): Promise<SafeUser[]> {
        return UserRepository.getAllUsers(branchIds);
    }
    static async getUserById(userId: number): Promise<SafeUser | null> {
        return UserRepository.getUserById(userId);
    }
    static async updateUser(userId: number, data: UpdateUserInput): Promise<SafeUser> {
        return UserRepository.updateUser(userId, data);
    }
    static async updatePassword(userId: number, password: string): Promise<void> {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        await UserRepository.updatePassword(userId, passwordHash);
    }
}
