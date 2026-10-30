# Test data report (medyra-dev)

Status: **verified.** Rows were inserted and checked by `npm run seed:verify` (48 of 48 checks passed, run twice: after the first seed and again after `seed:clean` and a reseed). The data below is the state of medyra-dev after the reseed.

## What was inserted (database counts equal the plan)

| Item | Count |
| --- | --- |
| Accounts | 50 (46 completed onboarding, 4 left incomplete) |
| Members by role | 18 students, 17 professionals, 5 educators, 5 researchers, 5 independent |
| Members by city | Montréal 22, Laval 6, Longueuil 5, Châteauguay 3, Brossard 3, Terrebonne 2, Repentigny 2, Saint-Jérôme 2, Vaudreuil-Dorion 2, Sherbrooke 1, Québec 2 |
| Members by language | French 34, English 16 |
| Open to mentor / looking for a mentor | 7 / 10 |
| Education / experience / skill rows | 102 / 85 / 322 |
| Images | 50 (32 avatars, 18 covers) |
| Posts | 250: 70 questions and 30 in each of the other six categories |
| Posts by language | French 163, English 87 |
| Comments | 400 (French 260, English 140) |
| Likes | 600 |
| Connections | 40 (30 accepted, 10 pending) |
| Follows | 60 |

## Checks that passed (`seed:verify`)

Counts per table match the plan; no orphan rows or duplicate usernames; another member can read but not edit or delete a member's posts or comments, and cannot publish as them; incomplete profiles are hidden; anonymous access is blocked on profiles, posts, comments, likes, connections and follows; pending connections stay private; pagination returns 15, 15, 15, 1 for the member with 46 posts, with no duplicates; search works with and without accents; avatar loads. `npm run lint`, `typecheck`, `test` (538 tests) and `build` also passed.

## Not supported by the schema (not seeded)

Verification or badges, communities, mentorship-matching records, an admin role, a separate forum, threaded replies (`post_comments` has no parent column).

## Reviewed in the real app (signed in as the kept account, desktop and 375 px mobile)

- Home feed: French and English posts render with correct accents; category chips, like and comment counts show.
- A post containing `<`, `>`, `&`, quotes, « » and emoji renders as plain text (escaped correctly).
- The 3000-character post renders in full and ends with an ellipsis; no horizontal scroll.
- Profile pages: education (CEGEP, bachelor, master's), experience, skills, interests and mentorship areas show; the member with a 52-character first name and a 1000-character bio fits at mobile width; a member who never posted has an empty Posts tab; the mobile tab bar appears.
- Found and fixed in the generator: a working pharmacist was posting student-placement text. Posts on placement, exam-preparation and clinical-training themes now come only from students and recent graduates (when any exist for that field). The data was cleaned and reseeded after the fix.

## `seed:clean` round trip

`seed:clean` removed 50 seed accounts and 50 images (0 left over). `shurid.biswas@gmail.com` still existed with its profile (`seed:wipe` preview showed 1 account on the keep list, 0 to delete). Then `seed:dev` recreated everything.

## Known issues

- Member search uses plain `ilike`, so it is not accent-insensitive. Typing "levesque" still finds "Lévesque" through the ASCII username, but a surname that differs from the username would not match. Fixing it needs a schema change (for example `unaccent`), which was not made.
- Search now lives at `/network` (the other session's uncommitted work); the checks here used the same filters over the API.
- Seeding fires the notification triggers; seeded notifications are backdated and old ones marked read.
- The network migration (`20261101000001`) was applied to medyra-dev. It belongs to the other session's work, which is still uncommitted.
- French first-person agreement is adjusted by a word list, so a rare phrase may keep the wrong gender form.
- The Next.js dev overlay showed "1 Issue" on a profile page; it was not investigated.
- Not tested live: dark mode, keyboard navigation, and the other 40+ profiles individually.
