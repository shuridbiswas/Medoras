/**
 * Copies a seeded member's password to the clipboard WITHOUT printing it, so you can log in
 * without ever seeing or pasting the secret into a file or chat.
 *   npm run seed:login -- camille_lavoie
 * Prints the email to type into /login; the password is on the clipboard.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { ACCOUNTS_FILE, readAccounts } from "./api.ts";
import { assertDevOnly, loadEnvironment, SeedSafetyError } from "./safety.ts";

try {
  const target = assertDevOnly(loadEnvironment());
  const slug = process.argv[2];
  if (!slug) throw new Error("Usage: npm run seed:login -- <username>   (see TEST_ACCOUNTS.md)");
  if (!existsSync(ACCOUNTS_FILE)) throw new Error("scripts/.seed-output/accounts.json not found. Run seed:dev first.");
  const account = readAccounts(target.ref).accounts.find((a) => a.slug === slug);
  if (!account) throw new Error(`No seeded account named "${slug}".`);

  const command =
    process.platform === "win32" ? ["clip"] : process.platform === "darwin" ? ["pbcopy"] : ["xclip", "-selection", "clipboard"];
  const result = spawnSync(command[0], command.slice(1), { input: account.password });
  if (result.status !== 0) throw new Error(`Could not use the clipboard (${command[0]}).`);
  console.log(`Email: ${account.email}`);
  console.log("The password is on your clipboard. Paste it at /login, then copy something else.");
} catch (error) {
  console.error(
    error instanceof SeedSafetyError
      ? `Refusing to run: ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error),
  );
  process.exit(1);
}
