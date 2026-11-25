import type { Metadata } from "next";
import { ImageOffIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { getDictionary } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getDictionary()).common.photoUnavailable.title };
}

/**
 * Where GET /api/media/:id/file sends a photo opened in a new tab when the photo is gone or the
 * viewer may no longer see it, so they get a sentence instead of raw JSON or R2's XML error.
 */
export default async function PhotoUnavailablePage() {
    const t = await getDictionary();

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <ImageOffIcon />
                </EmptyMedia>
                <h1 className="text-xl font-semibold">{t.common.photoUnavailable.title}</h1>
                <EmptyDescription>{t.common.photoUnavailable.description}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
