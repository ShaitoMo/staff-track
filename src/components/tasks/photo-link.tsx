/** Opens a task's photo in a new tab. A plain link, not next/image: the optimizer fetches without the session cookie. */
export function PhotoLink({ mediaId, className }: { mediaId: number; className?: string }) {
    return (
        <a
            href={`/api/media/${mediaId}/file`}
            target="_blank"
            rel="noreferrer"
            className={className ?? "text-xs text-primary hover:underline"}
        >
            View photo
        </a>
    );
}
