// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ENTRY = "33333333-3333-4333-8333-333333333333";

let db = makeDb();
let signedIn = true;
let profile: Record<string, unknown> = {
  username: "amina_r",
  avatar_path: null,
  cover_path: null,
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}));
vi.mock("@/lib/auth/session", () => ({
  requireMember: async () => {
    if (!signedIn) redirectMock("/login");
    return { user: { id: ME }, profile };
  },
}));

const actions = await import("@/features/profile/actions");
const idle = { status: "idle" as const };

const basics = {
  firstName: "Amina",
  lastName: "Rahman",
  headline: "Psychology student",
  locationLabel: "Montreal, QC",
  memberType: "undergraduate_student",
  fields: ["psychology"],
  institution: "University of Montreal",
  qualification: "BSc Psychology",
  specialty: "",
  careerStage: "student",
};

const png = (size = 16) =>
  new File(
    [
      Uint8Array.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
        ...new Array(size).fill(0),
      ]),
    ],
    "p.png",
    {
      type: "image/png",
    },
  );

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  signedIn = true;
  profile = { username: "amina_r", avatar_path: null, cover_path: null };
});

describe("owner permissions and unauthorized edits", () => {
  it("sends signed-out callers to /login before touching any data", async () => {
    signedIn = false;
    const attempts = [
      () => actions.updateBasics(idle, makeFormData(basics)),
      () => actions.updateAbout(idle, makeFormData({ bio: "hi" })),
      () =>
        actions.saveEducation(
          idle,
          makeFormData({ institution: "X", qualification: "Y" }),
        ),
      () => actions.saveExperience(idle, makeFormData({})),
      () => actions.deleteEducation(idle, makeFormData({ id: ENTRY })),
      () =>
        actions.saveSkills(
          idle,
          makeFormData({ kind: "skill", names: ["Listening"] }),
        ),
      () => actions.uploadAvatar(idle, makeFormData({ image: png() })),
      () => actions.removeCover(),
    ];
    for (const attempt of attempts)
      expect(await redirectOf(attempt)).toBe("/login");
    expect(db.ops).toHaveLength(0);
  });

  it("always writes to the verified user's row, never to an id supplied by the client", async () => {
    await actions.updateBasics(
      idle,
      makeFormData({ ...basics, id: OTHER, profile_id: OTHER, user_id: OTHER }),
    );
    const [write] = db.writes();
    expect(write.table).toBe("profiles");
    expect(write.filters).toEqual([["id", ME]]);
    expect(JSON.stringify(write.payload)).not.toContain(OTHER);
  });

  it("scopes updates and deletes of education and experience to the owner", async () => {
    await actions.saveEducation(
      idle,
      makeFormData({ id: ENTRY, institution: "McGill", qualification: "BScN" }),
    );
    await actions.deleteEducation(idle, makeFormData({ id: ENTRY }));
    await actions.saveExperience(
      idle,
      makeFormData({
        id: ENTRY,
        title: "RN",
        organization: "CHUM",
        startMonth: "2024-05",
      }),
    );
    await actions.deleteExperience(idle, makeFormData({ id: ENTRY }));
    for (const write of db.writes()) {
      expect(write.filters).toContainEqual(["profile_id", ME]);
      expect(write.filters).toContainEqual(["id", ENTRY]);
    }
    expect(db.writes()).toHaveLength(4);
  });

  it("reports an edit of someone else's (or a missing) entry as not found", async () => {
    db = makeDb((op) => (op.kind === "update" ? { data: [] } : undefined));
    const state = await actions.saveEducation(
      idle,
      makeFormData({ id: ENTRY, institution: "McGill", qualification: "BScN" }),
    );
    expect(state).toMatchObject({
      status: "error",
      message: "That education entry no longer exists.",
    });
  });

  it("rejects malformed ids without querying", async () => {
    const state = await actions.deleteEducation(
      idle,
      makeFormData({ id: "1 OR 1=1" }),
    );
    expect(state.status).toBe("error");
    expect(db.ops).toHaveLength(0);
  });
});

describe("profile updates", () => {
  it("saves valid details and reports success", async () => {
    const state = await actions.updateBasics(idle, makeFormData(basics));
    expect(state).toEqual({
      status: "success",
      message: "Profile details saved.",
    });
    expect(db.writes()[0].payload).toMatchObject({
      first_name: "Amina",
      location_label: "Montreal, QC",
      member_type: "undergraduate_student",
      fields: ["psychology"],
      specialty: null,
    });
  });

  it("returns field errors and does not write when validation fails", async () => {
    const state = await actions.updateBasics(
      idle,
      makeFormData({
        ...basics,
        headline: "x",
        fields: [],
        memberType: "wizard",
        firstName: "",
      }),
    );
    expect(state.status).toBe("error");
    expect(Object.keys(state.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["headline", "fields", "memberType", "firstName"]),
    );
    expect(db.writes()).toHaveLength(0);
  });

  it("allows clearing optional fields and keeps the location optional", async () => {
    await actions.updateBasics(
      idle,
      makeFormData({ ...basics, locationLabel: "" }),
    );
    expect(db.writes()[0].payload).toMatchObject({ location_label: null });
    await actions.updateAbout(
      idle,
      makeFormData({ bio: "", professionalJourney: "", careerAspirations: "" }),
    );
    expect(db.writes()[1].payload).toEqual({
      bio: null,
      professional_journey: null,
      career_aspirations: null,
    });
  });

  it("shows a friendly error when the database rejects the save", async () => {
    db = makeDb(() => ({ error: { code: "500", message: "boom" } }));
    const state = await actions.updateAbout(
      idle,
      makeFormData({ bio: "hello" }),
    );
    expect(state).toEqual({
      status: "error",
      message: "We couldn't save that. Please try again.",
    });
  });

  it("saves self-reported mentorship preferences", async () => {
    await actions.updateMentorship(
      idle,
      makeFormData({ lookingForMentorship: "on" }),
    );
    expect(db.writes()[0].payload).toEqual({
      looking_for_mentorship: true,
      open_to_mentor: false,
    });
  });
});

describe("education and experience", () => {
  it("adds an entry for the signed-in member", async () => {
    const state = await actions.saveEducation(
      idle,
      makeFormData({
        institution: "McGill",
        qualification: "BScN",
        startYear: "2022",
        currentlyStudying: "on",
        endYear: "2030",
      }),
    );
    expect(state.message).toBe("Education added.");
    expect(db.writes()[0]).toMatchObject({
      kind: "insert",
      table: "profile_education",
    });
    // A current program keeps no end year.
    expect(db.writes()[0].payload).toMatchObject({
      profile_id: ME,
      start_year: 2022,
      end_year: null,
      currently_studying: true,
    });
  });

  it("validates year order and date order", async () => {
    const edu = await actions.saveEducation(
      idle,
      makeFormData({
        institution: "A",
        qualification: "B",
        startYear: "2024",
        endYear: "2020",
      }),
    );
    expect(edu.fieldErrors?.endYear).toBeDefined();
    const exp = await actions.saveExperience(
      idle,
      makeFormData({
        title: "RN",
        organization: "CHUM",
        startMonth: "2024-05",
        endMonth: "2023-01",
      }),
    );
    expect(exp.fieldErrors?.endMonth).toBeDefined();
    expect(db.writes()).toHaveLength(0);
  });

  it("stores experience months as the first day and drops the end date for a current job", async () => {
    await actions.saveExperience(
      idle,
      makeFormData({
        title: "RN",
        organization: "CHUM",
        employmentType: "full_time",
        startMonth: "2024-05",
        endMonth: "2025-01",
        isCurrent: "on",
      }),
    );
    expect(db.writes()[0].payload).toMatchObject({
      start_date: "2024-05-01",
      end_date: null,
      is_current: true,
      employment_type: "full_time",
    });
  });

  it("explains the per-profile limit", async () => {
    db = makeDb((op) =>
      op.kind === "insert" ? { error: { code: "23514" } } : undefined,
    );
    const state = await actions.saveEducation(
      idle,
      makeFormData({ institution: "A", qualification: "B" }),
    );
    expect(state.message).toMatch(/limit of 20/);
  });
});

describe("skills and interests", () => {
  it("replaces the list: removes dropped items, adds new ones, keeps the rest", async () => {
    db = makeDb((op) =>
      op.kind === "select"
        ? {
            data: [
              { id: "a", name: "Listening" },
              { id: "b", name: "Old skill" },
            ],
          }
        : undefined,
    );
    const state = await actions.saveSkills(
      idle,
      makeFormData({ kind: "skill", names: ["listening", "Triage", "TRIAGE"] }),
    );
    expect(state.status).toBe("success");
    const [del, ins] = db.writes();
    expect(del).toMatchObject({ kind: "delete", table: "profile_skills" });
    expect(del.filters).toEqual(
      expect.arrayContaining([
        ["id", ["b"]],
        ["profile_id", ME],
      ]),
    );
    expect(ins.payload).toEqual([
      { profile_id: ME, name: "Triage", kind: "skill" },
    ]);
  });

  it("rejects bad names, unknown kinds and over-long lists", async () => {
    expect(
      (
        await actions.saveSkills(
          idle,
          makeFormData({ kind: "skill", names: ["<b>x</b>"] }),
        )
      ).status,
    ).toBe("error");
    expect(
      (
        await actions.saveSkills(
          idle,
          makeFormData({ kind: "badge", names: ["Fine"] }),
        )
      ).status,
    ).toBe("error");
    const tooMany = Array.from({ length: 11 }, (_, i) => `Area ${i}`);
    const state = await actions.saveSkills(
      idle,
      makeFormData({ kind: "mentorship_area", names: tooMany }),
    );
    expect(state.message).toMatch(/up to 10/);
    expect(db.writes()).toHaveLength(0);
  });
});

describe("image uploads", () => {
  it("uploads a valid profile photo into the member's own folder and saves the path", async () => {
    await actions.uploadAvatar(idle, makeFormData({ image: png() }));
    const [path] = db.storage.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${ME}/[0-9a-f-]{36}\\.png$`));
    expect(db.writes()[0].payload).toEqual({ avatar_path: path });
    expect(db.writes()[0].filters).toEqual([["id", ME]]);
  });

  it("replaces and cleans up the previous image", async () => {
    profile = {
      username: "amina_r",
      cover_path: `${ME}/old.jpg`,
      avatar_path: null,
    };
    await actions.uploadCover(idle, makeFormData({ image: png() }));
    expect(db.storage.remove).toHaveBeenCalledWith([`${ME}/old.jpg`]);
  });

  it("rejects files that are not real images, however they are named", async () => {
    const fake = new File(
      [new TextEncoder().encode("<svg onload=alert(1)>")],
      "me.png",
      { type: "image/png" },
    );
    const state = await actions.uploadAvatar(
      idle,
      makeFormData({ image: fake }),
    );
    expect(state).toEqual({
      status: "error",
      message: "Use a JPEG, PNG or WebP image.",
    });
    expect(db.storage.upload).not.toHaveBeenCalled();
    expect(db.writes()).toHaveLength(0);
  });

  it("enforces different size limits for photos (2 MB) and covers (5 MB)", async () => {
    const threeMb = png(3 * 1024 * 1024);
    const avatar = await actions.uploadAvatar(
      idle,
      makeFormData({ image: threeMb }),
    );
    expect(avatar.message).toMatch(/under 2 MB/);
    const cover = await actions.uploadCover(
      idle,
      makeFormData({ image: threeMb }),
    );
    expect(cover.status).toBe("success");
    const sixMb = png(6 * 1024 * 1024);
    expect(
      (await actions.uploadCover(idle, makeFormData({ image: sixMb }))).message,
    ).toMatch(/under 5 MB/);
  });

  it("requires a file and cleans up if saving the path fails", async () => {
    expect((await actions.uploadAvatar(idle, makeFormData({}))).message).toBe(
      "Choose an image to upload.",
    );
    db = makeDb((op) =>
      op.kind === "update" ? { error: { code: "500" } } : undefined,
    );
    const state = await actions.uploadAvatar(
      idle,
      makeFormData({ image: png() }),
    );
    expect(state.status).toBe("error");
    expect(db.storage.remove).toHaveBeenCalledOnce();
  });

  it("removes an image and its file", async () => {
    profile = {
      username: "amina_r",
      avatar_path: `${ME}/a.png`,
      cover_path: null,
    };
    const state = await actions.removeAvatar();
    expect(state.message).toBe("Profile photo removed.");
    expect(db.writes()[0].payload).toEqual({ avatar_path: null });
    expect(db.storage.remove).toHaveBeenCalledWith([`${ME}/a.png`]);
  });
});
