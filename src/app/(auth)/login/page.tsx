import type { Metadata } from "next";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { LoginForm } from "@/components/login/login-form";
import { getDictionary } from "@/i18n/server";
import { nextPath } from "@/lib/login-redirect";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).login.title };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
    const { next } = await searchParams;

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
            <div className="absolute top-3 end-3">
                <LanguageSwitcher />
            </div>
            <LoginForm next={nextPath(typeof next === "string" ? next : undefined)} />
        </div>
    );
}
