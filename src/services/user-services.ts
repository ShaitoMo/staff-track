import bcrypt from "bcrypt";
import { User, SafeUser } from "@/types/user";
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
    static async getAllUsers(): Promise<SafeUser[]> {
        return UserRepository.getAllUsers();
    }
}
