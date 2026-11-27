import bcrypt from "bcrypt";
import { User, SafeUser, UpdateUserInput } from "@/types/user";
import { UserRepository } from "@/repository/user-repository";
import { IncorrectPasswordError } from "@/exceptions/incorrect-password-error";
import { UserNotFoundError } from "@/exceptions/user-not-found-error";

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
    /** `page` counts from 1; a page past the end comes back with no items, not an error. */
    static async getUsersPage(branchIds: number[] | undefined, page: number, limit: number): Promise<{ items: SafeUser[], total: number }> {
        return UserRepository.getUsersPage(branchIds, (page - 1) * limit, limit);
    }
    static async getUserById(userId: number): Promise<SafeUser | null> {
        return UserRepository.getUserById(userId);
    }
    static async updateUser(userId: number, data: UpdateUserInput): Promise<SafeUser> {
        return UserRepository.updateUser(userId, data);
    }
    /** Reset password: an owner or manager sets it for someone else, no current password needed. */
    static async resetPassword(userId: number, password: string): Promise<void> {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        await UserRepository.updatePassword(userId, passwordHash);
    }
    /** Change password: the User replaces their own, proving it's them with the current one. */
    static async changeOwnPassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
        const currentHash = await UserRepository.getPasswordHash(userId);
        if (currentHash === null) {
            throw new UserNotFoundError();
        }
        if (!(await bcrypt.compare(currentPassword, currentHash))) {
            throw new IncorrectPasswordError();
        }
        await UserService.resetPassword(userId, newPassword);
    }
}
