import { FieldLegend, FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * A page form as one card: sections under rules, the submit button in a footer. The caller sets the
 * width (`max-w-3xl` for a couple of fields, `max-w-5xl` when short fields share rows). On a touch
 * screen the text fields and pickers grow to a 44px target; a mouse keeps the compact 32px.
 */
export function FormCard({ className, children, ...props }: React.ComponentProps<"form">) {
    return (
        <form noValidate className={cn("w-full", className)} {...props}>
            <div className="rounded-xl bg-card ring-1 ring-foreground/10 [@media(pointer:coarse)]:**:data-[slot=input]:h-11! [@media(pointer:coarse)]:**:data-[slot=select-trigger]:h-11!">
                {children}
            </div>
        </form>
    );
}

/** Form-level messages (a rejected save, a partial success), above the first section. */
export function FormAlerts({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col gap-3 px-4 pt-4 sm:px-6 sm:pt-6">{children}</div>;
}

/**
 * One section: its name in a narrow left column from `md` up, the fields to the right; on a phone,
 * the name above. The legend floats so it leaves the fieldset's border and sits in the grid like any
 * other box (HTML: a floated legend isn't the "rendered legend"). Pass `className` to lay the fields
 * out, e.g. `lg:grid-cols-3` to put short pickers side by side.
 */
export function FormSection({ legend, className, children }: { legend: string; className?: string; children: React.ReactNode }) {
    return (
        <FieldSet className="grid gap-x-8 gap-y-4 border-t border-border px-4 py-6 first-of-type:border-t-0 sm:px-6 md:grid-cols-[10rem_minmax(0,1fr)]">
            <FieldLegend className="float-left mb-0 font-semibold">{legend}</FieldLegend>
            <div className={cn("grid min-w-0 content-start items-start gap-x-4 gap-y-5", className)}>{children}</div>
        </FieldSet>
    );
}

/** The end of the reading path, under its own rule. Its button grows to 44px on a touch screen, like the fields. */
export function FormFooter({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex justify-end border-t border-border px-4 py-4 sm:px-6 [@media(pointer:coarse)]:*:data-[slot=button]:h-11">
            {children}
        </div>
    );
}
