import type { login as en } from "../en/login";
import { words } from "./words";

export const login: typeof en = {
    title: "تسجيل الدخول",
    description: "سجّل الدخول برقم هاتفك وكلمة المرور.",
    phone: words.phone,
    password: words.password,
    phoneRequired: words.phoneRequired,
    passwordRequired: "كلمة المرور مطلوبة.",
    invalidCredentials: "رقم الهاتف أو كلمة المرور غير صحيحة.",
    signIn: "تسجيل الدخول",
};
