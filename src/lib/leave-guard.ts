/** The parts of a click the guard looks at. A DOM `MouseEvent` fits. */
export interface LinkClick {
    button: number;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    defaultPrevented: boolean;
}

/** The parts of the clicked `<a>` the guard looks at: its resolved `href`, `target`, and whether it has `download`. */
export interface ClickedAnchor {
    href: string;
    target: string;
    download: boolean;
}

/**
 * Where a link click would take the app, as a path, when it is a client-side move to another page.
 * Null when the guard should stay out of it.
 */
export function leavingHref(click: LinkClick, anchor: ClickedAnchor, here: string): string | null {
    // a new tab, window or download leaves this page open, and the draft with it
    if (click.defaultPrevented || click.button !== 0) return null;
    if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
    if ((anchor.target !== "" && anchor.target !== "_self") || anchor.download) return null;

    const url = new URL(anchor.href, here);
    const current = new URL(here);
    // another site is a full page load, which `beforeunload` already asks about
    if (url.origin !== current.origin) return null;
    // a hash or the page itself leaves nothing behind
    if (url.pathname === current.pathname && url.search === current.search) return null;

    return url.pathname + url.search + url.hash;
}
