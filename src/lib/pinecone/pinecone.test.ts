// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const embedMock = vi.fn();
const upsertMock = vi.fn();
const deleteManyMock = vi.fn();
const queryMock = vi.fn();
const indexFactory = vi.fn();
let allowedIds: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: class {
    constructor(public config: unknown) {}
    inference = { embed: embedMock };
    index = (opts: unknown) => {
      indexFactory(opts);
      return { upsert: upsertMock, deleteMany: deleteManyMock, query: queryMock };
    };
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          eq: async () => ({ data: allowedIds.map((id) => ({ id })), error: null }),
        }),
      }),
    }),
  }),
}));

const { profileDocument, parseVectorId, vectorId } = await import("@/lib/pinecone/records");
const { upsertDocuments, deleteDocuments, searchProfileIds } = await import(
  "@/lib/pinecone/service"
);
const { isPineconeEnabled, resetPineconeForTests, PINECONE_NAMESPACES } = await import(
  "@/lib/pinecone/client"
);

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const profile = {
  id: A,
  headline: "Psychology student",
  specialty: "Neuropsychology",
  fields: ["psychology"],
  career_stage: "early_career",
  onboarding_completed: true,
};

function configure() {
  vi.stubEnv("PINECONE_API_KEY", "pc_test");
  vi.stubEnv("PINECONE_INDEX", "medyra-dev");
}

beforeEach(() => {
  vi.clearAllMocks();
  resetPineconeForTests();
  allowedIds = [];
  embedMock.mockResolvedValue({ data: [{ values: [0.1, 0.2] }] });
});
afterEach(() => vi.unstubAllEnvs());

describe("what is embedded", () => {
  it("uses only structured, member-chosen fields", () => {
    const doc = profileDocument(
      {
        ...profile,
        // Extra columns must be ignored even if they appear on the row.
        ...({
          bio: "I have been treated for depression",
          professional_journey: "private story",
          first_name: "Amina",
          last_name: "Rahman",
          location_label: "Montreal",
        } as object),
      },
      [
        { name: "Active listening", kind: "skill" },
        { name: "Trauma-informed care", kind: "interest" },
        { name: "Clinical placements", kind: "mentorship_area" },
      ],
    );
    expect(doc?.id).toBe(`profile:${A}`);
    expect(doc?.text).toContain("Headline: Psychology student");
    expect(doc?.text).toContain("Fields: Psychology");
    expect(doc?.text).toContain("Skills: Active listening");
    expect(doc?.text).toContain("Mentorship areas: Clinical placements");
    expect(doc?.text).not.toMatch(/depression|private story|Amina|Rahman|Montreal/);
    expect(JSON.stringify(doc?.metadata)).not.toMatch(/Amina|Rahman|@|depression/);
    expect(doc?.metadata).toMatchObject({ kind: "profile", pgId: A, visibility: "members" });
  });

  it("never embeds a profile that hasn't finished onboarding, or one with nothing to embed", () => {
    expect(profileDocument({ ...profile, onboarding_completed: false }, [])).toBeNull();
    expect(
      profileDocument(
        { ...profile, headline: null, specialty: null, fields: [], career_stage: null },
        [],
      ),
    ).toBeNull();
  });

  it("links vector ids to PostgreSQL ids and parses them back safely", () => {
    expect(vectorId("profile", A)).toBe(`profile:${A}`);
    expect(parseVectorId(`profile:${A.toUpperCase()}`)).toEqual({ kind: "profile", id: A });
    for (const bad of ["post:" + A, "profile:nope", "", `profile:${A}; drop`])
      expect(parseVectorId(bad)).toBeNull();
  });
});

describe("when Pinecone is not configured", () => {
  it("is disabled and every operation quietly does nothing", async () => {
    expect(isPineconeEnabled()).toBe(false);
    expect(await upsertDocuments("profiles", [profileDocument(profile, [])!])).toEqual({
      enabled: false,
      upserted: 0,
    });
    await expect(deleteDocuments("profiles", [`profile:${A}`])).resolves.toBeUndefined();
    expect(await searchProfileIds("nurse")).toEqual({ enabled: false, ids: [] });
    expect(embedMock).not.toHaveBeenCalled();
  });
});

describe("when configured", () => {
  it("embeds as passages and upserts into the profiles namespace", async () => {
    configure();
    const doc = profileDocument(profile, [])!;
    expect(await upsertDocuments("profiles", [doc])).toEqual({ enabled: true, upserted: 1 });
    expect(indexFactory).toHaveBeenCalledWith({ name: "medyra-dev", namespace: "profiles" });
    expect(embedMock).toHaveBeenCalledWith({
      model: "multilingual-e5-large",
      inputs: [doc.text],
      parameters: { inputType: "passage", truncate: "END" },
    });
    expect(upsertMock).toHaveBeenCalledWith({
      records: [{ id: doc.id, values: [0.1, 0.2], metadata: doc.metadata }],
    });
  });

  it("deletes by id", async () => {
    configure();
    await deleteDocuments(PINECONE_NAMESPACES.profiles, [`profile:${A}`]);
    expect(deleteManyMock).toHaveBeenCalledWith({ ids: [`profile:${A}`] });
  });

  it("search returns only ids PostgreSQL confirms the viewer may see", async () => {
    configure();
    queryMock.mockResolvedValue({
      matches: [{ id: `profile:${A}` }, { id: `profile:${B}` }, { id: "junk" }],
    });
    allowedIds = [A]; // B is hidden from this viewer by row level security
    expect(await searchProfileIds("neuropsychology mentor")).toEqual({ enabled: true, ids: [A] });
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vector: [0.1, 0.2],
        filter: { visibility: { $eq: "members" } },
        includeMetadata: false,
      }),
    );
    expect(embedMock.mock.calls[0][0].parameters.inputType).toBe("query");
  });

  it("clamps topK and the query length", async () => {
    configure();
    queryMock.mockResolvedValue({ matches: [] });
    await searchProfileIds("x".repeat(2000), 999);
    expect(queryMock.mock.calls[0][0].topK).toBe(25);
    expect(embedMock.mock.calls[0][0].inputs[0]).toHaveLength(500);
  });

  it("never throws when Pinecone fails", async () => {
    configure();
    embedMock.mockRejectedValue(new Error("pinecone down"));
    await expect(searchProfileIds("x")).resolves.toEqual({ enabled: true, ids: [] });
    await expect(upsertDocuments("profiles", [profileDocument(profile, [])!])).resolves.toMatchObject({
      upserted: 0,
    });
  });
});
