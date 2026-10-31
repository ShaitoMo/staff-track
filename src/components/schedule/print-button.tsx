"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { TOUCH_HEIGHT } from "@/lib/touch";

/** Opens the browser's print dialog, which also saves as PDF. The page's print styles do the layout. */
export function PrintButton() {
    const t = useT();

    return (
        <Button type="button" variant="outline" size="sm" className={TOUCH_HEIGHT} onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" />
            {t.schedule.print}
        </Button>
    );
}
