import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** A plain GET form: changing the date reloads /tasks with new search params, so there is no client state or JS. */
export function InstanceFilters({ date, branchId }: { date: string; branchId?: number }) {
    return (
        <form action="/tasks" method="get" className="flex items-end gap-2">
            <input type="hidden" name="view" value="instances" />
            {branchId !== undefined ? <input type="hidden" name="branch" value={branchId} /> : null}
            <Field className="w-auto">
                <FieldLabel htmlFor="date">Date</FieldLabel>
                <Input id="date" name="date" type="date" defaultValue={date} required />
            </Field>
            <Button type="submit" variant="outline" size="sm">
                Show
            </Button>
        </form>
    );
}
