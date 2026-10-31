import { plural, isolate } from "@/i18n/locales";
import type { layout as enLayout, nav as enNav } from "../en/layout";
import { common } from "./common";
import { words } from "./words";

export const layout: typeof enLayout = {
    skipToContent: "انتقل إلى المحتوى",
    sections: "الأقسام",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    account: (who) => `الحساب: ${isolate(who)}`,
    logOut: "تسجيل الخروج",
    branch: words.branch,
    branchTrigger: (name) => `الفرع: ${isolate(name)}. تغيير الفرع`,
    onlyThisBranch: "هذا الفرع فقط",
    previousDay: "اليوم السابق",
    nextDay: "اليوم التالي",
    backToToday: "العودة إلى اليوم",
    previousWeek: "الأسبوع السابق",
    nextWeek: "الأسبوع التالي",
    thisWeek: "هذا الأسبوع",
    backToThisWeek: "العودة إلى هذا الأسبوع",
    branchesFailed: (failed, consequence) =>
        `${plural("ar", failed, { one: "تعذّر تحميل أحد فروعك", two: "تعذّر تحميل فرعين من فروعك", few: "تعذّر تحميل # فروع من فروعك", other: "تعذّر تحميل # فرعًا من فروعك" })}، لذلك ${consequence}. أعد تحميل الصفحة للمحاولة مجددًا.`,
};

export const nav: typeof enNav = {
    groupToday: common.today,
    groupRun: "التشغيل",
    groupSetup: "الإعداد",
    dashboard: "لوحة التحكم",
    schedule: words.schedule,
    attendance: words.attendance,
    tasks: words.tasks,
    shelfGuide: words.shelfGuide,
    users: words.users,
    branches: words.branches,
    registers: words.registers,
    periods: words.periods,
    roles: words.rolesAndCoverage,
    sectionTypes: words.sectionTypes,
    home: "الرئيسية",
    myTasks: "مهامي",
    guide: "الدليل",
};
