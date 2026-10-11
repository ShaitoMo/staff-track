# Demo accounts

Created by `npx prisma db seed` (`src/prisma/seed.ts`). Every account uses the password **`123456`**; log in with the phone number. Re-running the seed wipes the database and recreates these exact accounts.

The `#` after a branch is the person's employee number on that branch's clock-in machine.

| Name | Role | Branch (machine #) | Phone | Note |
| --- | --- | --- | --- | --- |
| Karim Haddad | Owner | All branches | ` ` |  |
| Rania Khoury | Manager | Hamra (#101) | `70000001` |  |
| Tarek Mansour | Manager | Hamra (#102) | `70000004` |  |
| Georges Saliba | Manager | Achrafieh (#102) | `70000002` |  |
| Maya Nassar | Manager | Jounieh (#101) | `70000003` |  |
| Joelle Abi Nader | Cashier | Hamra (#106) | `71100104` |  |
| Lara Fakhoury | Cashier | Hamra (#103) | `71100101` |  |
| Nour El Hajj | Cashier | Hamra (#105) | `71100103` |  |
| Omar Itani | Cashier | Hamra (#104) | `71100102` |  |
| Ziad Sleiman | Cashier | Hamra (#107), Achrafieh (#101) | `71100105` |  |
| Christelle Tannous | Cashier | Achrafieh (#103) | `71200101` |  |
| Rami Jaber | Cashier | Achrafieh (#104) | `71200102` |  |
| Yara Daher | Cashier | Achrafieh (#105) | `71200103` |  |
| Carla Nehme | Cashier | Jounieh (#102) | `71300101` |  |
| Charbel Feghali | Cashier | Jounieh (#103) | `71300102` |  |
| Rita Sfeir | Cashier | Jounieh (#104) | `71300103` |  |
| Ali Hammoud | Stocker | Hamra (#108) | `71100106` |  |
| Elie Rizk | Stocker | Hamra (#109) | `71100107` |  |
| Samir Kanaan | Stocker | Hamra (#110) | `71100108` |  |
| Jad Moussa | Stocker | Achrafieh (#107) | `71200105` |  |
| Michel Azar | Stocker | Achrafieh (#106) | `71200104` |  |
| Elias Bou Khalil | Stocker | Jounieh (#106) | `71300105` | Inactive: can't log in |
| Joseph Hanna | Stocker | Jounieh (#105) | `71300104` |  |
| Bilal Sabbagh | Butcher | Hamra (#111) | `71100109` |  |
| Antoine Karam | Butcher | Achrafieh (#108) | `71200106` |  |
| Nabil Khalil | Butcher | Jounieh (#107) | `71300106` |  |
| Mariam Kassem | Cleaner | Hamra (#112) | `71100110` |  |
| Hiba Zein | Cleaner | Achrafieh (#109) | `71200107` |  |
| Sana Ayoub | Cleaner | Jounieh (#108) | `71300107` |  |

## Good accounts to start with

- **Owner, sees every branch:** Karim Haddad, `70000000`
- **Branch manager:** Rania Khoury (Hamra), `70000001`
- **Cashier working two branches:** Ziad Sleiman, `71100105`. Hamra Sun–Wed, Achrafieh Thu–Sat
- **Staff view:** Lara Fakhoury (Hamra cashier), `71100101`

## What's in the demo

- **Branches and registers:** three branches (Hamra, Achrafieh, Jounieh) with 4, 3 and 2 registers. The data covers the 1st of the month the seed runs in through the 15th of the next month (Beirut dates). Days before today have attendance and task results, later days have shifts and pending tasks, and nothing exists after the 15th.
- **Shifts:** built from Morning and Evening periods. Jounieh has its own later Morning (08:00–16:00). There is also a retired "Mid-day" period that only older shifts use, and a custom-hours Saturday for the Jounieh butcher.
- **Coverage targets:** set a little above who's actually scheduled, so the coverage grid shows real gaps.
- **Attendance:**
  - Past weeks come from one imported clock-machine file per branch per week. This week's punches come from the machine. A few were fixed by hand.
  - Most punches are on time. Some are late or leave early, a few are no-shows, and a few are missing a clock-in or a clock-out.
  - Today only shows punches up to the moment the seed ran.
- **Tasks:**
  - Daily and weekly routines for each role, a weekly report for each manager, one-off tasks, two tasks reported by the workers themselves, and one retired routine at Jounieh.
  - Older days are mostly verified, with a few rejected or missed. Recent days and today have work awaiting review.
- **Photo proof:** completed tasks have placeholder shelf photos stored in R2 under `task-instances/demo/`.
