"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOUCH_HEIGHT } from "@/lib/touch";

/** Opens the browser's print dialog, which also saves as PDF. The page's print styles do the layout. */
export function PrintButton() {
    return (
        <Button type="button" variant="outline" size="sm" className={TOUCH_HEIGHT} onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" />
            Print or save PDF
        </Button>
    );
}
