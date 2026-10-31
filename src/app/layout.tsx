import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { LocaleProvider } from "@/i18n/client";
import { dirOf } from "@/i18n/locales";
import { getDictionary, getLocale } from "@/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Arabic glyphs: the font stacks in globals.css fall through to this for Arabic text only.
// Self-hosted (Google's Arabic subset) so each weight can be served one step heavier and the glyphs scaled
// up: at Geist's size and weight, Plex Arabic reads smaller and fainter than the Latin beside it.
const plexArabic = localFont({
  variable: "--font-arabic",
  src: [
    { path: "./fonts/plex-arabic-500.woff2", weight: "400" },
    { path: "./fonts/plex-arabic-600.woff2", weight: "500" },
    { path: "./fonts/plex-arabic-700.woff2", weight: "600" },
  ],
  declarations: [
    { prop: "size-adjust", value: "108%" },
    { prop: "unicode-range", value: "U+0600-06FF, U+0750-077F, U+0870-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFF" },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return {
    // each page names itself, so a screen reader announces the page and tabs can be told apart (WCAG 2.4.2)
    title: { default: t.common.appName, template: `%s · ${t.common.appName}` },
    description: t.common.appDescription,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${geistSans.variable} ${geistMono.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
