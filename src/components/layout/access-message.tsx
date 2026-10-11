import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AccessMessage({ title, message }: { title: string; message: string }) {
    return (
        <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <Alert variant="destructive" className="mt-4">
                <AlertCircleIcon />
                <AlertDescription>{message}</AlertDescription>
            </Alert>
        </div>
    );
}
