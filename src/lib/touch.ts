/**
 * Coarse pointers (touch screens) get a full 44px tap target; mouse layouts keep the compact size.
 * Text controls grow in height only; square icon buttons grow both ways.
 */
export const TOUCH_HEIGHT = "[@media(pointer:coarse)]:h-11";
export const TOUCH_SIZE = "[@media(pointer:coarse)]:size-11";
