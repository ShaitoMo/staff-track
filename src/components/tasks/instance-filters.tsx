import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getDictionary } from "@/i18n/server";

/** A plain GET form: changing the date reloads /tasks with new search params, so there is no client state or JS. */
export async function InstanceFilters({ date, branchId }: { date: string; branchId?: number }) {
    const t = await getDictionary();

    return (
        <form action="/tasks" method="get" className="flex items-end gap-2">
            <input type="hidden" name="view" value="instances" />
            {branchId !== undefined ? <input type="hidden" name="branch" value={branchId} /> : null}
            <Field className="w-auto">
                <FieldLabel htmlFor="date">{t.tasks.date}</FieldLabel>
                <Input id="date" name="date" type="date" defaultValue={date} required />
            </Field>
            <Button type="submit" variant="outline" size="sm">
                {t.tasks.show}
            </Button>
        </form>
    );
}
