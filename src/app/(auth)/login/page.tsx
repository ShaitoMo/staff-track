import type { Metadata } from "next";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { LoginForm } from "@/components/login/login-form";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).login.title };
}

export default function LoginPage() {
    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
            <div className="absolute top-3 end-3">
                <LanguageSwitcher />
            </div>
            <LoginForm />
        </div>
    );
}
