// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb, type Op } from "@/test/db-mock";

let db = makeDb();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));

const queries = await import("@/features/network/queries");
const { parseDirectoryParams } = await import("@/features/network/schemas");

const ME = "11111111-1111-4111-8111-111111111111";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const D = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const filter = (op: Op, column: string) => op.filters.find(([c]) => c === column)?.[1];
const member = (id: string, first: string) => ({
  id,
  username: `${first.toLowerCase()}_x`,
  first_name: first,
  last_name: "Test",
  headline: null,
  avatar_path: null,
  member_type: "educator",
  institution: null,
  specialty: null,
  fields: [],
  country: "CA",
  location_label: null,
  open_to_mentor: false,
  looking_for_mentorship: false,
});

beforeEach(() => {
  db = makeDb();
});

describe("getRelationships", () => {
  it("tells apart sent, received, accepted and no relationship, plus follows", async () => {
    db = makeDb((op) => {
      if (op.table === "connections")
        return {
          data: [
            { id: "c1", requester_id: ME, addressee_id: A, status: "pending", created_at: "" },
            { id: "c2", requester_id: B, addressee_id: ME, status: "pending", created_at: "" },
            { id: "c3", requester_id: C, addressee_id: ME, status: "accepted", created_at: "" },
          ],
        };
      return { data: [{ followee_id: A }] };
    });
    const map = await queries.getRelationships(ME, [A, B, C, D, ME]);
    expect(map.get(A)).toEqual({ state: "request_sent", connectionId: "c1", following: true });
    expect(map.get(B)).toEqual({ state: "request_received", connectionId: "c2", following: false });
    expect(map.get(C)).toEqual({ state: "connected", connectionId: "c3", following: false });
    expect(map.get(D)).toEqual({ state: "none", connectionId: null, following: false });
    expect(map.has(ME)).toBe(false);
  });

  it("scopes the lookup to the viewer and the listed members, in both directions", async () => {
    await queries.getRelationships(ME, [A]);
    const connections = db.ops.find((o) => o.table === "connections");
    expect(filter(connections!, "or")).toBe(
      `and(requester_id.eq.${ME},addressee_id.in.(${A})),and(addressee_id.eq.${ME},requester_id.in.(${A}))`,
    );
    const follows = db.ops.find((o) => o.table === "follows");
    expect(filter(follows!, "follower_id")).toBe(ME);
  });

  it("asks nothing when there is nobody to look up", async () => {
    expect((await queries.getRelationships(ME, [ME])).size).toBe(0);
    expect(db.ops).toHaveLength(0);
  });
});

describe("getNetworkCounts", () => {
  it("counts accepted connections in either direction, and followers and following separately", async () => {
    db = makeDb((op) => {
      if (op.table === "connections") return { count: 7 };
      return { count: filter(op, "followee_id") ? 12 : 3 };
    });
    expect(await queries.getNetworkCounts(A)).toEqual({ connections: 7, followers: 12, following: 3 });
    const connections = db.ops.find((o) => o.table === "connections")!;
    expect(filter(connections, "status")).toBe("accepted");
    expect(filter(connections, "or")).toBe(`requester_id.eq.${A},addressee_id.eq.${A}`);
  });

  it("falls back to zero instead of failing the page", async () => {
    db = makeDb(() => ({ error: { message: "boom" }, count: null }));
    expect(await queries.getNetworkCounts(A)).toEqual({ connections: 0, followers: 0, following: 0 });
  });
});

describe("listRequests", () => {
  it("lists received requests for the addressee and sent requests for the requester, pending only", async () => {
    db = makeDb(() => ({ data: [{ id: "c1", created_at: "2026-10-30T00:00:00Z", member: member(A, "Ana") }] }));
    const incoming = await queries.listRequests(ME, "incoming");
    expect(incoming.requests).toHaveLength(1);
    expect(filter(db.ops[0], "addressee_id")).toBe(ME);
    expect(filter(db.ops[0], "status")).toBe("pending");

    db = makeDb(() => ({ data: [] }));
    await queries.listRequests(ME, "outgoing");
    expect(filter(db.ops[0], "requester_id")).toBe(ME);
  });

  it("reports a failure instead of an empty list", async () => {
    db = makeDb(() => ({ error: { message: "boom" } }));
    expect(await queries.listRequests(ME, "incoming")).toEqual({ requests: [], failed: true });
  });
});

describe("listConnections", () => {
  it("returns the other person in each accepted connection, with a page range and total", async () => {
    db = makeDb(() => ({
      count: 31,
      data: [
        { id: "c1", requester_id: A, addressee_id: B, requester: member(A, "Ana"), addressee: member(B, "Ben") },
        { id: "c2", requester_id: C, addressee_id: A, requester: member(C, "Cy"), addressee: member(A, "Ana") },
      ],
    }));
    const result = await queries.listConnections(A, 2, 10);
    expect(result.members.map((m) => m.first_name)).toEqual(["Ben", "Cy"]);
    expect(result.total).toBe(31);
    expect(filter(db.ops[0], "range")).toEqual([10, 19]);
    expect(filter(db.ops[0], "status")).toBe("accepted");
  });
});

describe("searchDirectory", () => {
  const search = (params: Record<string, string>) =>
    queries.searchDirectory(ME, parseDirectoryParams(params));
  const profilesOp = () => db.ops.find((o) => o.table === "profiles")!;

  it("leaves out the viewer, unfinished profiles and members the viewer blocked", async () => {
    db = makeDb((op) => (op.table === "member_blocks" ? { data: [{ blocked_id: A }] } : { data: [], count: 0 }));
    await search({});
    const op = profilesOp();
    expect(filter(op, "onboarding_completed")).toBe(true);
    expect(filter(op, "id!=")).toBe(ME);
    expect(filter(op, "id not")).toBe(`(${A})`);
  });

  it("applies every filter", async () => {
    db = makeDb(() => ({ data: [], count: 0 }));
    await search({
      q: "ana lopez",
      group: "student",
      field: "nursing",
      institution: "McGill",
      country: "CA",
      region: "Montreal",
      mentorship: "offering",
    });
    const op = profilesOp();
    expect(op.filters.filter(([c]) => c === "or")).toHaveLength(2); // one per name term
    expect(filter(op, "member_type")).toEqual(["undergraduate_student", "graduate_student", "recent_graduate"]);
    expect(filter(op, "fields contains")).toEqual(["nursing"]);
    expect(filter(op, "institution ilike")).toBe("%McGill%");
    expect(filter(op, "country")).toBe("CA");
    expect(filter(op, "location_label ilike")).toBe("%Montreal%");
    expect(filter(op, "open_to_mentor")).toBe(true);
  });

  it("supports the looking-for-a-mentor filter and pages of twelve", async () => {
    db = makeDb(() => ({ data: [], count: 0 }));
    await search({ mentorship: "seeking", page: "3" });
    const op = profilesOp();
    expect(filter(op, "looking_for_mentorship")).toBe(true);
    expect(filter(op, "range")).toEqual([24, 35]);
  });

  it("returns members with the total for pagination, and flags a failure", async () => {
    db = makeDb(() => ({ data: [member(A, "Ana")], count: 40 }));
    expect(await search({})).toMatchObject({ total: 40, members: [{ first_name: "Ana" }] });
    db = makeDb((op) => (op.table === "profiles" ? { error: { message: "boom" } } : { data: [] }));
    expect(await search({})).toEqual({ members: [], total: 0, failed: true });
  });

  it("keeps filter wildcards and filter syntax out of the query", async () => {
    db = makeDb(() => ({ data: [], count: 0 }));
    await search({ q: "100%_,(x)", institution: "A%B_C" });
    const op = profilesOp();
    const ors = op.filters.filter(([c]) => c === "or").map(([, v]) => String(v));
    // "100%_,(x)" becomes the two plain terms "100" and "x"; no wildcard or syntax survives.
    expect(ors).toEqual([
      "username.ilike.%100%,first_name.ilike.%100%,last_name.ilike.%100%",
      "username.ilike.%x%,first_name.ilike.%x%,last_name.ilike.%x%",
    ]);
    expect(String(filter(op, "institution ilike"))).toBe("%A B C%");
  });
});
