import * as attendance from "./en/attendance";
import * as common from "./en/common";
import * as dashboard from "./en/dashboard";
import * as guide from "./en/guide";
import * as layout from "./en/layout";
import * as login from "./en/login";
import * as schedule from "./en/schedule";
import * as setup from "./en/setup";
import * as tasks from "./en/tasks";
import * as words from "./en/words";

/** One namespace per area; every file under ./en exports its areas as named objects. */
export const en = { ...attendance, ...common, ...dashboard, ...guide, ...layout, ...login, ...schedule, ...setup, ...tasks, ...words };

export type Dictionary = typeof en;
