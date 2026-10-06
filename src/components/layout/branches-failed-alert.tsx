import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Some branches' reads failed but others loaded: say so above what did load, instead of letting
 * one branch blank the page. Renders nothing when `failed` is 0.
 */
export function BranchesFailedAlert({ failed, consequence }: { failed: number; consequence: string }) {
    if (failed === 0) return null;

    return (
        <Alert>
            <AlertCircleIcon />
            <AlertDescription>
                {failed === 1 ? "One of your branches" : `${failed} of your branches`} couldn&apos;t be loaded, so {consequence}.
                Reload the page to try again.
            </AlertDescription>
        </Alert>
    );
}

/** The settled values, and how many failed. When every one failed there is nothing to show, so the first error is thrown. */
export function settledOrThrow<T>(results: PromiseSettledResult<T>[]): { values: T[]; failed: number } {
    const values = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

    if (results.length > 0 && values.length === 0) {
        throw (results[0] as PromiseRejectedResult).reason;
    }

    return { values, failed: results.length - values.length };
}
