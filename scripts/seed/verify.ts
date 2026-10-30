/**
 * Checks the seeded dev data against the plan and exercises permissions as two real seeded
 * members through the public APIs (the same path the app uses).
 *   npm run seed:verify
 */
import { memberClient, readAccounts, signIn } from "./api.ts";
import { buildPlan, HEAVY_POSTER } from "./plan.ts";
import { assertDevOnly, loadEnvironment, requireManagementToken, SeedSafetyError } from "./safety.ts";
import { COUNT_SQL, managementQuery } from "./sql.ts";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
}

async function main() {
  const env = loadEnvironment();
  const target = assertDevOnly(env);
  const token = requireManagementToken(env);
  const plan = buildPlan();

  // --- 1. counts match the plan -------------------------------------------------------------
  const [counts] = await managementQuery<Record<string, number>[]>(target.ref, token, COUNT_SQL);
  const expected = {
    accounts: plan.members.length,
    completed_profiles: plan.members.filter((m) => m.complete).length,
    incomplete_profiles: plan.members.filter((m) => !m.complete).length,
    education: plan.members.reduce((n, m) => n + m.education.length, 0),
    experience: plan.members.reduce((n, m) => n + m.experience.length, 0),
    tags: plan.members.reduce((n, m) => n + m.tags.length, 0),
    posts: plan.posts.length,
    comments: plan.comments.length,
    likes: plan.likes.length,
    images: plan.members.filter((m) => m.avatar).length + plan.members.filter((m) => m.cover).length,
  };
  for (const [key, value] of Object.entries(expected)) {
    check(`${key}: database ${counts[key]} = plan ${value}`, counts[key] === value, `got ${counts[key]}`);
  }

  // --- 2. permissions as two seeded members ---------------------------------------------------
  const file = readAccounts(target.ref);
  const find = (slug: string) => file.accounts.find((a) => a.slug === slug);
  const aAccount = find(HEAVY_POSTER);
  const bAccount = find("jose_nunez");
  if (!aAccount || !bAccount) throw new Error("accounts.json does not contain the verification accounts. Run seed:dev first.");
  const aSession = await signIn(target, aAccount.email, aAccount.password);
  const bSession = await signIn(target, bAccount.email, bAccount.password);
  if (!aSession || !bSession) throw new Error("Could not sign in as the verification accounts.");
  const A = memberClient(target, aSession.token);
  const B = memberClient(target, bSession.token);

  const aPosts = plan.posts.filter((p) => p.authorSlug === HEAVY_POSTER);
  const countOf = (headers: Headers) => Number(/\/(\d+)$/.exec(headers.get("content-range") ?? "")?.[1] ?? -1);

  const seen = await B.rest<unknown[]>("GET", "posts", {
    params: { author_id: `eq.${aSession.id}`, select: "id", limit: "1" },
    prefer: "count=exact",
  });
  check("B sees all of A's posts", countOf(seen.headers) === aPosts.length, `count ${countOf(seen.headers)}`);

  const target1 = aPosts[0];
  const upd = await B.rest<unknown[]>("PATCH", "posts", {
    params: { id: `eq.${target1.id}` },
    body: { body: "hijacked" },
    prefer: "return=representation",
  });
  check("B cannot edit A's post (0 rows)", upd.status === 200 && upd.json.length === 0, JSON.stringify(upd.json).slice(0, 100));
  const del = await B.rest<unknown[]>("DELETE", "posts", {
    params: { id: `eq.${target1.id}` },
    prefer: "return=representation",
  });
  check("B cannot delete A's post (0 rows)", del.status === 200 && del.json.length === 0);
  const spoof = await B.rest("POST", "posts", {
    body: { author_id: aSession.id, category: "questions", body: "spoof" },
  });
  check("B cannot publish as A", spoof.status === 401 || spoof.status === 403, `HTTP ${spoof.status}`);
  const delComment = plan.comments.find((c) => c.authorSlug !== "jose_nunez");
  if (delComment) {
    const r = await B.rest<unknown[]>("DELETE", "post_comments", {
      params: { id: `eq.${delComment.id}` },
      prefer: "return=representation",
    });
    check("B cannot delete someone else's comment (0 rows)", r.status === 200 && r.json.length === 0);
  }

  const incomplete = plan.members.filter((m) => !m.complete).map((m) => m.email);
  const incompleteIds = await managementQuery<{ id: string }[]>(
    target.ref,
    token,
    `select id from auth.users where email in (${incomplete.map((e) => `'${e}'`).join(",")})`,
  );
  const hidden = await B.rest<unknown[]>("GET", "profiles", {
    params: { id: `in.(${incompleteIds.map((r) => r.id).join(",")})`, select: "id" },
  });
  check("incomplete profiles are invisible to other members", hidden.status === 200 && hidden.json.length === 0, JSON.stringify(hidden.json).slice(0, 100));
  const listed = await B.rest<{ id: string }[]>("GET", "profiles", {
    params: { select: "id", onboarding_completed: "eq.false" },
  });
  check("B can't list any incomplete profile", listed.status === 200 && listed.json.length === 0, `${listed.json.length} visible`);

  // --- keyset pagination exactly as the app does it ------------------------------------------
  const ids: string[] = [];
  let cursor: { created_at: string; id: string } | null = null;
  const sizes: number[] = [];
  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      select: "id,created_at",
      author_id: `eq.${aSession.id}`,
      order: "created_at.desc,id.desc",
      limit: "15",
    };
    if (cursor) {
      params.or = `(created_at.lt."${cursor.created_at}",and(created_at.eq."${cursor.created_at}",id.lt.${cursor.id}))`;
    }
    const r: { json: { id: string; created_at: string }[] } = await B.rest<{ id: string; created_at: string }[]>("GET", "posts", { params });
    sizes.push(r.json.length);
    ids.push(...r.json.map((p) => p.id));
    if (r.json.length < 15) break;
    cursor = r.json[r.json.length - 1];
  }
  check(
    `pagination: pages of ${sizes.join(", ")} cover all ${aPosts.length} posts`,
    ids.length === aPosts.length && new Set(ids).size === ids.length && sizes.slice(0, -1).every((s) => s === 15),
    `${ids.length} ids, ${new Set(ids).size} unique`,
  );

  // --- counts on a post match the plan --------------------------------------------------------
  const engaged = plan.posts.find(
    (p) => plan.likes.some((l) => l.postId === p.id) && plan.comments.some((c) => c.postId === p.id),
  )!;
  const counts2 = await B.rest<{ likes: { count: number }[]; comments: { count: number }[] }[]>("GET", "posts", {
    params: { id: `eq.${engaged.id}`, select: "likes:post_likes(count),comments:post_comments(count)" },
  });
  check(
    "like and comment counts on a post match the plan",
    counts2.json[0]?.likes?.[0]?.count === plan.likes.filter((l) => l.postId === engaged.id).length &&
      counts2.json[0]?.comments?.[0]?.count === plan.comments.filter((c) => c.postId === engaged.id).length,
    JSON.stringify(counts2.json),
  );

  // --- search ---------------------------------------------------------------------------------
  const byName = await B.rest<{ username: string }[]>("GET", "profiles", {
    params: { select: "username", or: "(username.ilike.%ngu%,first_name.ilike.%ngu%,last_name.ilike.%ngu%)", onboarding_completed: "eq.true" },
  });
  check("search by name finds Casey Nguyen", byName.json.some((p) => p.username === HEAVY_POSTER));
  const byField = await B.rest<{ username: string }[]>("GET", "profiles", {
    params: { select: "username", fields: "cs.{psychology}", onboarding_completed: "eq.true" },
  });
  check("search by field finds psychology members", byField.json.length >= 4, `${byField.json.length} found`);
  const mentors = await B.rest<{ username: string }[]>("GET", "profiles", {
    params: { select: "username", open_to_mentor: "eq.true", onboarding_completed: "eq.true" },
  });
  check("mentor filter finds the 8 members open to mentoring", mentors.json.length === 8, `${mentors.json.length} found`);

  // --- images load ----------------------------------------------------------------------------
  const withAvatar = await A.rest<{ avatar_path: string | null }[]>("GET", "profiles", {
    params: { select: "avatar_path", id: `eq.${aSession.id}` },
  });
  const avatarPath = withAvatar.json[0]?.avatar_path;
  if (avatarPath) {
    const image = await fetch(`${target.url}/storage/v1/object/public/avatars/${avatarPath}`);
    check("A's avatar loads from its public URL as a PNG", image.status === 200 && image.headers.get("content-type") === "image/png", `HTTP ${image.status}`);
  } else {
    console.log("SKIP  A has no avatar in this plan");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof SeedSafetyError
      ? `\nRefusing to run: ${error.message}`
      : `\nVerify failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
