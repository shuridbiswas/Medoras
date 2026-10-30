# Test accounts (fictional, development database only)

Everyone below is a **fictional** persona created by the seed tool (`npm run seed:dev`). No password is written in this file, ever. Passwords are random and live only in the git-ignored `scripts/.seed-output/accounts.json`.

## How to log in without handling a password

1. Start the app (`npm run dev`) and open `/login`.
2. Copy the persona's password to your clipboard without printing it:

   ```bash
   npm run seed:login -- camille_lavoie
   ```

   It prints the email (`seed+<username>@example.com`) and puts the password on the clipboard.
3. Type the email, paste the password, sign in. Copy something else afterwards to clear the clipboard.

If `accounts.json` is gone (for example after `seed:clean`), run `npm run seed:dev` again; it recreates the accounts with new random passwords.

## Personas

| Persona | Username | Language, city | Good for testing |
| --- | --- | --- | --- |
| Prolific poster (nursing master's student who also works as a nurse) | `camille_lavoie` | FR, Montréal | 46 posts and pagination at 15 per page; heavy Activity tab; the most interactions |
| Nursing student | `anais_lapointe` | FR, Laval | Undergraduate profile, CEGEP then bachelor timeline, student view of the feed |
| Nursing student, quiet | `ethan_goldberg` | EN, Montréal | No posts, empty bio, no headline-rich profile; empty Activity tab |
| Psychology student | `amira_benali` | FR, Montréal | Looking for a mentor; psychology search and field filters |
| Registered nurse | `fatima_zahra_idrissi` | FR, Montréal | Working professional, open to mentoring, hospital experience |
| Registered nurse | `emily_thompson` | EN, Vaudreuil-Dorion | English-language professional profile |
| Professor / clinical educator | `andre_tremblay` | FR, Montréal | Educator, open to mentoring, long career timeline |
| Educator with a very long name and a 1000-character bio | `maria_guadalupe_h` | FR, Montréal | Layout stress test: long name, maximum-length bio |
| Researcher | `sarah_mitchell` | EN, Montréal | Researcher profile, open to mentoring; used by `seed:verify` as the "other member" |
| Independent / private-practice professional | `yasmine_haddad` | EN, Montréal | Self-employed experience entry |
| Rarely active members | `aisha_diallo`, `wei_zhang`, `yannick_ouellet` | FR/EN | Profiles with little or no activity |
| New member who has not finished onboarding | `chloe_dubois` | FR | Sign in and you land on `/onboarding`; other members must not see this profile (also `pascal_bergeron`, `alexis_martel`, `melodie_paquette`) |

All 50 accounts follow the same pattern: `seed+<username>@example.com`. The full list (name, language, city, role) is printed by `npm run seed:dev -- --dry-run`.

## Not available

These personas are **not provided because the product does not have the feature yet**: an administrator or moderator account, and a "verified" professional. There is no admin role, no verification process and no verification badge in the database, and the product forbids inventing badges before a real process exists.
