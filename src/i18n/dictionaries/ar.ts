import type { Dictionary } from "./en";
import * as attendance from "./ar/attendance";
import * as common from "./ar/common";
import * as dashboard from "./ar/dashboard";
import * as errors from "./ar/errors";
import * as guide from "./ar/guide";
import * as layout from "./ar/layout";
import * as login from "./ar/login";
import * as password from "./ar/password";
import * as schedule from "./ar/schedule";
import * as setup from "./ar/setup";
import * as tasks from "./ar/tasks";
import * as words from "./ar/words";

export const ar: Dictionary = { ...attendance, ...common, ...dashboard, ...errors, ...guide, ...layout, ...login, ...password, ...schedule, ...setup, ...tasks, ...words };
