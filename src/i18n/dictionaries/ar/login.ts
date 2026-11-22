import { isolate } from "@/i18n/locales";
import type { login as en, password as enPassword } from "../en/login";
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

export const password: typeof enPassword = {
    change: "تغيير كلمة المرور",
    changeDescription: "سيُسجَّل خروجك من أجهزتك الأخرى، ويبقى هذا الجهاز مسجّلًا.",
    current: "كلمة المرور الحالية",
    new: "كلمة المرور الجديدة",
    confirm: "تأكيد كلمة المرور الجديدة",
    changed: "تم تغيير كلمة المرور.",
    done: "تم",
    resetLegend: words.password,
    resetDescription: (name) =>
        `عيّن كلمة مرور جديدة لـ${isolate(name)} وأعطها له شخصيًا. سيُسجَّل خروجه من كل الأجهزة.`,
    reset: "إعادة تعيين كلمة المرور",
    resetDone: (name) => `أُعيد تعيين كلمة المرور. أعطِ ${isolate(name)} كلمة المرور الجديدة.`,
    failed: "تعذّر تغيير كلمة المرور. حاول مجددًا.",
    errors: {
        currentRequired: "أدخل كلمة المرور الحالية.",
        length: "يجب أن تكون كلمة المرور بين 8 و100 حرف.",
        mismatch: "كلمتا المرور غير متطابقتين.",
    },
};
