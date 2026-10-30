import {
  CAREER_STAGES,
  COUNTRY_CODES,
  EMPLOYMENT_TYPES,
  FIELDS,
  MEMBER_TYPES,
  PURPOSES,
  RESERVED_USERNAMES,
} from "../../src/features/onboarding/options.ts";
import {
  COMMENT_MAX_LENGTH,
  FEED_PAGE_SIZE,
  POST_CATEGORIES,
  POST_MAX_LENGTH,
} from "../../src/features/feed/options.ts";
import {
  BIO_SUFFIX,
  CITIES,
  CLOSERS,
  COMMENTS,
  ESCAPING_POSTS,
  EXTRAS,
  INTERESTS,
  LONG_SENTENCES,
  MENTORSHIP_AREAS,
  OPENERS,
  POST_BASES,
  QUESTION_NOTE,
  SCHOOLS,
  SKILLS_BY_FIELD,
  TOPICS,
  WORKPLACES,
} from "./content.ts";
import { createRng, exactLength, type Rng } from "./prng.ts";

/**
 * Deterministic plan for the development seed data. Pure: no network, no files. The runner
 * (seed.ts) executes it; the tests (seed.test.ts) validate it against the database constraints.
 * Every identity is fictional, and no post or comment contains clinical or identifying detail.
 */

export const SEED_VALUE = 20261030;
export const EMAIL_DOMAIN = "example.com";
export const EMAIL_PREFIX = "seed+";
export const HEAVY_POSTER = "casey_ngu";

export type SeedEducation = {
  institution: string;
  qualification: string;
  field_of_study: string | null;
  start_year: number;
  end_year: number | null;
  currently_studying: boolean;
  description: string | null;
};

export type SeedExperience = {
  title: string;
  organization: string;
  employment_type: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
};

export type SeedTag = { name: string; kind: "skill" | "interest" | "mentorship_area" };

export type SeedMember = {
  slug: string;
  email: string;
  firstName: string;
  lastName: string;
  complete: boolean;
  username: string | null;
  memberType: string;
  fields: string[];
  careerStage: string | null;
  country: string | null;
  locationLabel: string | null;
  headline: string | null;
  bio: string | null;
  journey: string | null;
  aspirations: string | null;
  institution: string | null;
  qualification: string | null;
  specialty: string | null;
  lookingForMentorship: boolean;
  openToMentor: boolean;
  purposes: string[];
  city: string | null;
  avatar: boolean;
  cover: boolean;
  education: SeedEducation[];
  experience: SeedExperience[];
  tags: SeedTag[];
};

export type SeedPost = {
  id: string;
  authorSlug: string;
  category: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
};
export type SeedComment = {
  id: string;
  postId: string;
  authorSlug: string;
  body: string;
  createdAt: string;
};
export type SeedLike = { postId: string; userSlug: string; createdAt: string };

export type Plan = {
  members: SeedMember[];
  posts: SeedPost[];
  comments: SeedComment[];
  likes: SeedLike[];
};

// ---------------------------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------------------------

type Row = {
  slug: string;
  first: string;
  last: string;
  type: string;
  field: string;
  stage: string;
  country: string;
  location: string | null;
};

const COMPLETE_ROWS: Row[] = [
  { slug: "casey_ngu", first: "Casey", last: "Nguyen", type: "graduate_student", field: "psychology", stage: "student", country: "CA", location: "Montreal, QC" },
  { slug: "amina_r", first: "Amina", last: "Rahman", type: "undergraduate_student", field: "psychology", stage: "student", country: "CA", location: "Montreal, QC" },
  { slug: "sam_k", first: "Sam", last: "Kowalski", type: "undergraduate_student", field: "social_work", stage: "student", country: "CA", location: "Winnipeg, MB" },
  { slug: "zoe_angstrom", first: "Zoë", last: "Ångström", type: "recent_graduate", field: "nursing", stage: "new_graduate", country: "SE", location: "Uppsala" },
  { slug: "jose_nunez", first: "José", last: "Núñez", type: "healthcare_professional", field: "nursing", stage: "mid_career", country: "CA", location: "Calgary, AB" },
  { slug: "lea_tremblay", first: "Léa", last: "Tremblay-Côté", type: "healthcare_professional", field: "occupational_therapy", stage: "early_career", country: "CA", location: "Québec City, QC" },
  { slug: "priya_r", first: "Priya", last: "Raghunathan", type: "researcher", field: "public_health", stage: "mid_career", country: "CA", location: "Toronto, ON" },
  { slug: "dana_okafor", first: "Dana", last: "Okafor", type: "educator", field: "nursing", stage: "senior", country: "CA", location: "Halifax, NS" },
  { slug: "minh_anh", first: "Minh Anh", last: "Nguyễn", type: "graduate_student", field: "pharmacy", stage: "student", country: "US", location: null },
  { slug: "liam_osullivan", first: "Liam", last: "O'Sullivan", type: "social_services_professional", field: "social_work", stage: "mid_career", country: "CA", location: "Ottawa, ON" },
  { slug: "siobhan_ob", first: "Siobhán", last: "Ó Briain", type: "researcher", field: "psychology", stage: "early_career", country: "IE", location: "Cork" },
  { slug: "yuki_t", first: "Yuki", last: "Tanaka", type: "graduate_student", field: "speech_language_pathology", stage: "student", country: "CA", location: "Vancouver, BC" },
  { slug: "omar_h", first: "Omar", last: "Haddad", type: "healthcare_professional", field: "physiotherapy", stage: "early_career", country: "CA", location: "Edmonton, AB" },
  { slug: "grace_m", first: "Grace", last: "Mwangi", type: "recent_graduate", field: "audiology", stage: "new_graduate", country: "CA", location: "Saskatoon, SK" },
  { slug: "ethan_b", first: "Ethan", last: "Brooks", type: "undergraduate_student", field: "nursing", stage: "student", country: "US", location: "Boston, MA" },
  { slug: "ines_f", first: "Inês", last: "Ferreira", type: "educator", field: "physiotherapy", stage: "senior", country: "PT", location: "Porto" },
  { slug: "noah_s", first: "Noah", last: "Sinclair", type: "healthcare_professional", field: "medicine", stage: "mid_career", country: "CA", location: "Victoria, BC" },
  { slug: "farah_a", first: "Farah", last: "Ahmadi", type: "social_services_professional", field: "social_work", stage: "early_career", country: "CA", location: null },
  { slug: "tomas_k", first: "Tomáš", last: "Kovář", type: "researcher", field: "other", stage: "mid_career", country: "CZ", location: "Brno" },
  { slug: "hannah_lee", first: "Hannah", last: "Lee", type: "undergraduate_student", field: "occupational_therapy", stage: "student", country: "AU", location: "Brisbane" },
  { slug: "ravi_p", first: "Ravi", last: "Patel", type: "healthcare_professional", field: "pharmacy", stage: "senior", country: "GB", location: "Leeds" },
  { slug: "mei_l", first: "Mei", last: "Lin", type: "recent_graduate", field: "public_health", stage: "new_graduate", country: "CA", location: "Burnaby, BC" },
  { slug: "jordan_w", first: "Jordan", last: "Whitaker", type: "other", field: "other", stage: "other", country: "CA", location: null },
  // Edge case: very long name (still inside the 60-character limits).
  { slug: "alexandrina_long", first: "Wilhelmina Alexandrina Maximiliana", last: "Montgomery-Featherstonehaugh", type: "educator", field: "psychology", stage: "mid_career", country: "CA", location: "St. John's, NL" },
  { slug: "sage_n", first: "Sage", last: "Nakamura", type: "graduate_student", field: "medicine", stage: "student", country: "CA", location: "London, ON" },
  { slug: "bruno_c", first: "Bruno", last: "Castillo", type: "healthcare_professional", field: "nursing", stage: "early_career", country: "CA", location: null },
];

/** Accounts that exist but never finished onboarding. Other members must not see them. */
const INCOMPLETE_ROWS = [
  { slug: "pending_riley", first: "Riley", last: "Pending", partial: false },
  { slug: "pending_morgan", first: "Morgan", last: "Draft", partial: true },
  { slug: "pending_avery", first: "Avery", last: "Waiting", partial: false },
  { slug: "pending_quinn", first: "Quinn", last: "Unfinished", partial: true },
];

const OPEN_TO_MENTOR = new Set([
  "jose_nunez",
  "priya_r",
  "dana_okafor",
  "liam_osullivan",
  "ines_f",
  "noah_s",
  "ravi_p",
  "alexandrina_long",
]);
const LOOKING_FOR_MENTOR = new Set([
  "amina_r",
  "sam_k",
  "casey_ngu",
  "zoe_angstrom",
  "minh_anh",
  "yuki_t",
  "grace_m",
  "ethan_b",
  "hannah_lee",
  "mei_l",
]);
const EMPTY_BIO = new Set(["sage_n", "farah_a", "bruno_c"]);
const NO_HEADLINE = new Set(["bruno_c", "hannah_lee"]);
/** Complete members who never post, to test an empty Activity tab. */
export const NON_POSTERS = new Set(["ethan_b", "hannah_lee", "jordan_w", "sage_n"]);

const fieldLabel = (value: string) =>
  FIELDS.find((f) => f.value === value)?.label ?? "Health and social services";
const lower = (text: string) => text.toLowerCase();

function headlineFor(row: Row, rng: Rng): string {
  const f = fieldLabel(row.field);
  const topic = rng.pick(TOPICS);
  const byType: Record<string, string[]> = {
    undergraduate_student: [`${f} student | curious about ${topic}`, `Undergraduate ${lower(f)} student`],
    graduate_student: [`Graduate ${lower(f)} student exploring ${topic}`, `Master's candidate in ${lower(f)}`],
    recent_graduate: [`New ${lower(f)} graduate | open to learning`, `Recent ${lower(f)} graduate looking for the right fit`],
    healthcare_professional: [`${f} professional | ${rng.pick(TOPICS)}`, `${f} practitioner, always learning`],
    social_services_professional: [`${f} in community services | ${rng.pick(TOPICS)}`, `Community-based ${lower(f)} practitioner`],
    educator: [`${f} educator and placement supervisor`, `Teaching ${lower(f)} and supporting new learners`],
    researcher: [`Researcher in ${lower(f)} | ${topic}`, `Studying ${topic}`],
    other: ["Community member interested in health and social services"],
  };
  return rng.pick(byType[row.type] ?? byType.other).slice(0, 120);
}

function bioFor(row: Row, rng: Rng): string {
  const f = lower(fieldLabel(row.field));
  const topic = rng.pick(TOPICS);
  const starts: Record<string, string> = {
    undergraduate_student: `I'm an undergraduate student in ${f}, still working out where I fit.`,
    graduate_student: `I'm a graduate student in ${f} balancing coursework, research and placements.`,
    recent_graduate: `I recently graduated in ${f} and am finding my feet in the field.`,
    healthcare_professional: `I work in ${f} and enjoy teamwork across roles.`,
    social_services_professional: `I work in community services and care about practical, person-centred support.`,
    educator: `I teach and supervise ${f} students and love seeing them grow.`,
    researcher: `I do research in ${f} and enjoy turning findings into plain language.`,
    other: "I'm part of this community in a supporting role.",
  };
  const second = `I'm interested in ${topic} and ${lower(rng.pick(INTERESTS))}.`;
  const third = rng.chance(0.5) ? " Always happy to swap notes and learn from others." : "";
  return `${starts[row.type]} ${second}${third}${BIO_SUFFIX}`;
}

function maxBio(rng: Rng): string {
  const sentences: string[] = [];
  let length = 0;
  while (length < 1100) {
    const s = rng.pick(LONG_SENTENCES);
    sentences.push(s);
    length += s.length + 1;
  }
  const core = exactLength(sentences.join(" "), 1000 - BIO_SUFFIX.length);
  return core + BIO_SUFFIX;
}

function journeyFor(row: Row, rng: Rng): string {
  const f = lower(fieldLabel(row.field));
  return `My path into ${f} wasn't a straight line. ${rng.pick(LONG_SENTENCES)} ${rng.pick(LONG_SENTENCES)}`.slice(0, 600);
}

function aspirationsFor(row: Row, rng: Rng): string {
  return `Over the next few years I'd like to deepen my skills in ${lower(rng.pick(INTERESTS))}, learn from people further along, and eventually give back by supporting others. ${lower(row.type).includes("student") ? "First, finishing my studies well." : ""}`.trim();
}

const monthDate = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-01`;

function educationFor(row: Row, rng: Rng): SeedEducation[] {
  const f = fieldLabel(row.field);
  const school = () => rng.pick(SCHOOLS);
  const bachelor = (start: number): SeedEducation => ({
    institution: school(),
    qualification: `Bachelor's degree in ${f}`,
    field_of_study: f,
    start_year: start,
    end_year: start + 4,
    currently_studying: false,
    description: rng.chance(0.4) ? "Included two clinical or community placements." : null,
  });
  switch (row.type) {
    case "undergraduate_student":
      return [{
        institution: school(),
        qualification: `Bachelor's degree in ${f}`,
        field_of_study: f,
        start_year: rng.int(2023, 2025),
        end_year: null,
        currently_studying: true,
        description: null,
      }];
    case "graduate_student":
      return [
        {
          institution: school(),
          qualification: `Master's degree in ${f}`,
          field_of_study: f,
          start_year: 2025,
          end_year: null,
          currently_studying: true,
          description: null,
        },
        bachelor(rng.int(2017, 2021)),
      ];
    case "recent_graduate":
      return [bachelor(2021)];
    case "educator":
    case "researcher":
      return [
        {
          institution: school(),
          qualification: `Doctoral degree in ${f}`,
          field_of_study: f,
          start_year: rng.int(2008, 2014),
          end_year: rng.int(2016, 2020),
          currently_studying: false,
          description: null,
        },
        bachelor(rng.int(1998, 2006)),
      ];
    case "other":
      return rng.chance(0.5) ? [bachelor(2012)] : [];
    default:
      return rng.chance(0.5)
        ? [bachelor(rng.int(2005, 2018)), { ...bachelor(2019), qualification: `Master's degree in ${f}`, end_year: 2021 }]
        : [bachelor(rng.int(2005, 2018))];
  }
}

function experienceFor(row: Row, rng: Rng): SeedExperience[] {
  const place = () => rng.pick(WORKPLACES);
  const f = lower(fieldLabel(row.field));
  const type = (value: string) => EMPLOYMENT_TYPES.find((t) => t.value === value)?.value ?? "other";
  switch (row.type) {
    case "undergraduate_student":
    case "graduate_student":
      return rng.chance(0.6)
        ? [{
            title: "Volunteer",
            organization: place(),
            employment_type: type("volunteer"),
            start_date: monthDate(2025, rng.int(1, 9)),
            end_date: null,
            is_current: true,
            description: "Weekly shifts supporting community programs.",
          }]
        : [];
    case "recent_graduate":
      return [
        {
          title: "Placement student",
          organization: place(),
          employment_type: type("placement"),
          start_date: monthDate(2025, 1),
          end_date: monthDate(2025, 4),
          is_current: false,
          description: null,
        },
        {
          title: "Junior team member",
          organization: place(),
          employment_type: type("part_time"),
          start_date: monthDate(2026, 1),
          end_date: null,
          is_current: true,
          description: null,
        },
      ];
    case "other":
      return [];
    default: {
      const first = rng.int(2008, 2018);
      const out: SeedExperience[] = [
        {
          title: `Early-career ${f} role`,
          organization: place(),
          employment_type: type("full_time"),
          start_date: monthDate(first, rng.int(1, 12)),
          end_date: monthDate(first + rng.int(2, 4), rng.int(1, 12)),
          is_current: false,
          description: rng.chance(0.5) ? "Learned the fundamentals and supported new colleagues." : null,
        },
        {
          title: row.type === "researcher" ? "Research associate" : row.type === "educator" ? "Clinical instructor" : "Team member",
          organization: place(),
          employment_type: type("full_time"),
          start_date: monthDate(first + 5, rng.int(1, 12)),
          end_date: null,
          is_current: true,
          description: null,
        },
      ];
      return out;
    }
  }
}

function tagsFor(row: Row, mentor: boolean, seeker: boolean, rng: Rng): SeedTag[] {
  const pool = [...(SKILLS_BY_FIELD[row.field] ?? SKILLS_BY_FIELD.other)];
  const skills = rng.sample(pool, rng.int(2, 5)).map((name) => ({ name, kind: "skill" as const }));
  const interests = rng
    .sample(INTERESTS, rng.int(1, 3))
    .map((name) => ({ name, kind: "interest" as const }));
  const areaCount = mentor ? 2 : seeker ? 1 : rng.int(0, 1);
  const areas = rng
    .sample(MENTORSHIP_AREAS, areaCount)
    .map((name) => ({ name, kind: "mentorship_area" as const }));
  return [...skills, ...interests, ...areas];
}

function buildMembers(rng: Rng): SeedMember[] {
  const members: SeedMember[] = [];

  COMPLETE_ROWS.forEach((row, i) => {
    const mentor = OPEN_TO_MENTOR.has(row.slug);
    const seeker = LOOKING_FOR_MENTOR.has(row.slug);
    const purposeValues = PURPOSES.map((p) => p.value);
    const purposes = rng.sample(purposeValues, rng.int(1, 3));
    if (mentor && !purposes.includes("become_mentor")) purposes[0] = "become_mentor";
    if (seeker && !purposes.includes("find_mentor")) purposes[0] = "find_mentor";

    members.push({
      slug: row.slug,
      email: `${EMAIL_PREFIX}${row.slug}@${EMAIL_DOMAIN}`,
      firstName: row.first,
      lastName: row.last,
      complete: true,
      username: row.slug,
      memberType: row.type,
      fields: row.field === "other" ? ["other"] : [row.field, ...(rng.chance(0.15) ? ["public_health"] : [])].filter((v, idx, arr) => arr.indexOf(v) === idx),
      careerStage: row.stage,
      country: row.country,
      locationLabel: row.location,
      headline: NO_HEADLINE.has(row.slug) ? null : headlineFor(row, rng),
      bio:
        row.slug === "dana_okafor"
          ? maxBio(rng) // exactly 1000 characters
          : EMPTY_BIO.has(row.slug)
            ? null
            : bioFor(row, rng),
      journey: rng.chance(0.7) ? journeyFor(row, rng) : null,
      aspirations: rng.chance(0.6) ? aspirationsFor(row, rng) : null,
      institution: rng.pick(row.type.includes("professional") ? WORKPLACES : SCHOOLS),
      qualification: `${row.stage === "student" ? "Studying" : "Qualified"}: ${fieldLabel(row.field)}`.slice(0, 120),
      specialty: rng.chance(0.6) ? rng.pick(TOPICS).replace(/^./, (c) => c.toUpperCase()) : null,
      lookingForMentorship: seeker,
      openToMentor: mentor,
      purposes,
      city: rng.chance(0.6) ? rng.pick(CITIES) : null,
      // About 70% get an avatar, 40% a cover (deterministic by position).
      avatar: ![3, 6, 9].includes(i % 10),
      cover: [0, 2].includes(i % 5),
      education: educationFor(row, rng),
      experience: experienceFor(row, rng),
      tags: tagsFor(row, mentor, seeker, rng),
    });
  });

  INCOMPLETE_ROWS.forEach((row) => {
    members.push({
      slug: row.slug,
      email: `${EMAIL_PREFIX}${row.slug}@${EMAIL_DOMAIN}`,
      firstName: row.first,
      lastName: row.last,
      complete: false,
      username: null,
      memberType: "other",
      fields: [],
      careerStage: null,
      country: null,
      locationLabel: null,
      headline: row.partial ? "Setting up my profile" : null,
      bio: null,
      journey: null,
      aspirations: null,
      institution: null,
      qualification: null,
      specialty: null,
      lookingForMentorship: false,
      openToMentor: false,
      purposes: [],
      city: null,
      avatar: false,
      cover: false,
      education: [],
      experience: [],
      tags: [],
    });
  });

  return members;
}

// ---------------------------------------------------------------------------------------------
// Posts, comments, likes
// ---------------------------------------------------------------------------------------------

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const TARGETS = { posts: 150, heavyPosts: 46, comments: [240, 260], likes: [480, 520] } as const;

function composePost(category: string, rng: Rng): string {
  const base = rng.pick(POST_BASES[category]);
  const body = `${rng.pick(OPENERS)}${base}${rng.pick(EXTRAS)}${rng.pick(CLOSERS)}`;
  return category === "questions" ? body + QUESTION_NOTE : body;
}

function longPost(rng: Rng): string {
  const parts: string[] = [];
  let length = 0;
  while (length < 3200) {
    const paragraph = Array.from({ length: 3 }, () => rng.pick(LONG_SENTENCES)).join(" ");
    parts.push(paragraph);
    length += paragraph.length + 2;
  }
  return exactLength(parts.join("\n\n"), POST_MAX_LENGTH);
}

function multiParagraphPost(rng: Rng): string {
  return Array.from({ length: rng.int(3, 4) }, () => rng.pick(LONG_SENTENCES)).join("\n\n");
}

function longComment(rng: Rng): string {
  const text: string[] = [];
  let length = 0;
  while (length < 1100) {
    const s = rng.pick(LONG_SENTENCES);
    text.push(s);
    length += s.length + 1;
  }
  return exactLength(text.join(" "), COMMENT_MAX_LENGTH);
}

/** Minutes-ago offsets for one author, at least 40 minutes apart so no hourly limit can matter. */
function spacedOffsets(count: number, rng: Rng, minAgo: number, maxAgo: number): number[] {
  const taken: number[] = [];
  let guard = 0;
  while (taken.length < count && guard++ < 100_000) {
    const candidate = rng.int(minAgo, maxAgo);
    if (taken.every((t) => Math.abs(t - candidate) >= 40)) taken.push(candidate);
  }
  if (taken.length < count) throw new Error("Could not space posts apart");
  return taken;
}

export function buildPlan(now: Date = new Date(), seed: number = SEED_VALUE): Plan {
  const rng = createRng(seed);
  const members = buildMembers(rng);
  const completed = members.filter((m) => m.complete);
  const bySlug = new Map(members.map((m) => [m.slug, m]));
  const posters = completed.filter((m) => !NON_POSTERS.has(m.slug));
  const others = posters.filter((m) => m.slug !== HEAVY_POSTER);
  const nowMs = now.getTime();
  const iso = (ms: number) => new Date(ms).toISOString();

  // --- post contents: all seven categories, specials first, the rest by category rotation ---
  const categories = POST_CATEGORIES.map((c) => c.value as string);
  const contents: { category: string; body: string }[] = [];
  contents.push({ category: "general_discussion", body: longPost(rng) });
  for (const special of ESCAPING_POSTS) contents.push({ ...special });
  for (let i = 0; i < 6; i++) {
    const category = categories[(i + 2) % categories.length];
    contents.push({
      category,
      body: multiParagraphPost(rng) + (category === "questions" ? QUESTION_NOTE : ""),
    });
  }
  while (contents.length < TARGETS.posts) {
    const category = categories[contents.length % categories.length];
    contents.push({ category, body: composePost(category, rng) });
  }
  const shuffled = rng.shuffle(contents);

  // --- authors: one heavy poster, the rest weighted so some members post a lot and some little ---
  const authors: string[] = Array(TARGETS.heavyPosts).fill(HEAVY_POSTER);
  const weights = others.map(() => rng.int(1, 6));
  const weighted = others.flatMap((m, i) => Array(weights[i]).fill(m.slug) as string[]);
  const rest = TARGETS.posts - TARGETS.heavyPosts;
  const counts = new Map<string, number>();
  for (let i = 0; i < rest; i++) {
    let pick = rng.pick(weighted);
    // Keep any single other author under 14 posts so the heavy poster stands out.
    while ((counts.get(pick) ?? 0) >= 13) pick = rng.pick(weighted);
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    authors.push(pick);
  }

  // --- timestamps per author (minutes ago) ---
  const offsetsByAuthor = new Map<string, number[]>();
  for (const slug of new Set(authors)) {
    const n = authors.filter((a) => a === slug).length;
    offsetsByAuthor.set(slug, spacedOffsets(n, rng, 90, 30 * 24 * 60));
  }

  const posts: SeedPost[] = shuffled.map((content, i) => {
    const authorSlug = authors[i];
    const minutesAgo = offsetsByAuthor.get(authorSlug)!.pop()!;
    const createdMs = nowMs - minutesAgo * MINUTE;
    const edited = rng.chance(0.1);
    const editedMs = createdMs + rng.int(30, 48 * 60) * MINUTE;
    return {
      id: rng.uuid(),
      authorSlug,
      category: content.category,
      body: content.body,
      createdAt: iso(createdMs),
      editedAt: edited && editedMs < nowMs - 5 * MINUTE ? iso(editedMs) : null,
    };
  });

  // --- comments ---
  const commenters = completed.map((m) => m.slug);
  const comments: SeedComment[] = [];
  const addComment = (post: SeedPost, body?: string) => {
    const authorSlug = rng.chance(0.15) ? post.authorSlug : rng.pick(commenters);
    const postMs = Date.parse(post.createdAt);
    const latest = Math.min(postMs + 7 * DAY, nowMs - 5 * MINUTE);
    const createdMs = postMs + rng.int(5 * MINUTE, Math.max(6 * MINUTE, latest - postMs));
    comments.push({
      id: rng.uuid(),
      postId: post.id,
      authorSlug,
      body: body ?? rng.pick(COMMENTS),
      createdAt: iso(Math.min(createdMs, nowMs - 5 * MINUTE)),
    });
  };
  const engaged = posts.filter(() => rng.chance(0.65));
  for (const post of engaged) {
    const k = rng.chance(0.08) ? rng.int(9, 12) : rng.int(1, 5);
    for (let i = 0; i < k; i++) addComment(post);
  }
  while (comments.length < TARGETS.comments[0]) addComment(rng.pick(engaged));
  while (comments.length > TARGETS.comments[1]) comments.pop();
  // Three comments at exactly the maximum length.
  for (const i of [0, 1, 2]) comments[i].body = longComment(rng);

  // --- likes (one per member per post, never the author's own post) ---
  const likes: SeedLike[] = [];
  const likedPosts = posts.filter(() => rng.chance(0.65));
  const likeFor = (post: SeedPost, taken: Set<string>) => {
    const candidates = commenters.filter((s) => s !== post.authorSlug && !taken.has(s));
    if (candidates.length === 0) return;
    const userSlug = rng.pick(candidates);
    taken.add(userSlug);
    const postMs = Date.parse(post.createdAt);
    likes.push({
      postId: post.id,
      userSlug,
      createdAt: iso(Math.min(postMs + rng.int(2 * MINUTE, 5 * DAY), nowMs - 2 * MINUTE)),
    });
  };
  const takenByPost = new Map<string, Set<string>>();
  for (const post of likedPosts) {
    const taken = new Set<string>();
    takenByPost.set(post.id, taken);
    const k = rng.chance(0.1) ? rng.int(10, 16) : rng.int(1, 6);
    for (let i = 0; i < k; i++) likeFor(post, taken);
  }
  while (likes.length < TARGETS.likes[0]) {
    const post = rng.pick(likedPosts);
    likeFor(post, takenByPost.get(post.id)!);
  }
  while (likes.length > TARGETS.likes[1]) likes.pop();

  void bySlug;
  return { members, posts: posts.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), comments, likes };
}

// ---------------------------------------------------------------------------------------------
// Validation (mirrors the database constraints; the tests and the runner both use it)
// ---------------------------------------------------------------------------------------------

const enumValues = {
  memberType: MEMBER_TYPES.map((m) => m.value as string),
  field: FIELDS.map((f) => f.value as string),
  stage: CAREER_STAGES.map((s) => s.value as string),
  employment: EMPLOYMENT_TYPES.map((e) => e.value as string),
  purpose: PURPOSES.map((p) => p.value as string),
  category: POST_CATEGORIES.map((c) => c.value as string),
};

const LIMITS = { skill: 30, interest: 20, mentorship_area: 10 } as const;

export function validatePlan(plan: Plan, now: Date = new Date()): string[] {
  const problems: string[] = [];
  const bad = (message: string) => problems.push(message);
  const nowMs = now.getTime();

  const usernames = new Set<string>();
  const emails = new Set<string>();
  const slugs = new Set<string>();
  const countryCodes = new Set<string>(COUNTRY_CODES as readonly string[]);

  for (const m of plan.members) {
    const who = m.slug;
    if (slugs.has(m.slug)) bad(`${who}: duplicate slug`);
    slugs.add(m.slug);
    if (emails.has(m.email)) bad(`${who}: duplicate email`);
    emails.add(m.email);
    if (!/^seed\+[a-z0-9_]+@example\.com$/.test(m.email)) bad(`${who}: email not in the seed pattern`);
    if (m.firstName.length < 1 || m.firstName.length > 60) bad(`${who}: first name length`);
    if (m.lastName.length > 60) bad(`${who}: last name length`);
    if (m.username !== null) {
      if (!/^[a-z0-9_]{3,30}$/.test(m.username)) bad(`${who}: username format`);
      if ((RESERVED_USERNAMES as readonly string[]).includes(m.username)) bad(`${who}: reserved username`);
      if (usernames.has(m.username)) bad(`${who}: duplicate username`);
      usernames.add(m.username);
    }
    if (m.headline && m.headline.length > 120) bad(`${who}: headline length`);
    if (m.bio !== null) {
      if (m.bio.length > 1000) bad(`${who}: bio length`);
      if (!m.bio.endsWith(BIO_SUFFIX)) bad(`${who}: bio must end with the fictional-profile suffix`);
    }
    if (m.journey && m.journey.length > 2000) bad(`${who}: journey length`);
    if (m.aspirations && m.aspirations.length > 1000) bad(`${who}: aspirations length`);
    if (m.locationLabel && m.locationLabel.length > 80) bad(`${who}: location length`);
    if (m.city && m.city.length > 80) bad(`${who}: city length`);
    for (const v of [m.institution, m.qualification, m.specialty]) {
      if (v && v.length > 120) bad(`${who}: institution/qualification/specialty length`);
    }
    if (!enumValues.memberType.includes(m.memberType)) bad(`${who}: member type`);
    for (const f of m.fields) if (!enumValues.field.includes(f)) bad(`${who}: field ${f}`);
    if (m.careerStage && !enumValues.stage.includes(m.careerStage)) bad(`${who}: career stage`);
    if (m.country && !countryCodes.has(m.country)) bad(`${who}: country`);
    for (const p of m.purposes) if (!enumValues.purpose.includes(p)) bad(`${who}: purpose`);
    if (m.complete) {
      if (!m.username || m.fields.length < 1 || !m.careerStage || !m.country)
        bad(`${who}: completed profile is missing essentials`);
    } else if (m.username !== null) bad(`${who}: incomplete members have no username`);

    for (const e of m.education) {
      if (e.institution.length < 1 || e.institution.length > 120) bad(`${who}: education institution`);
      if (e.qualification.length < 1 || e.qualification.length > 120) bad(`${who}: education qualification`);
      if (e.start_year < 1940 || e.start_year > 2100) bad(`${who}: education start year`);
      if (e.end_year !== null && (e.end_year < e.start_year || e.end_year > 2100)) bad(`${who}: education end year`);
      if (e.currently_studying && e.end_year !== null) bad(`${who}: current program with an end year`);
    }
    if (m.education.length > 20) bad(`${who}: too many education rows`);
    for (const x of m.experience) {
      if (x.title.length < 1 || x.title.length > 120) bad(`${who}: experience title`);
      if (x.organization.length < 1 || x.organization.length > 120) bad(`${who}: experience organization`);
      if (x.employment_type && !enumValues.employment.includes(x.employment_type)) bad(`${who}: employment type`);
      if (x.end_date !== null && x.end_date < x.start_date) bad(`${who}: experience dates out of order`);
      if (x.is_current && x.end_date !== null) bad(`${who}: current job with an end date`);
      if (x.description && x.description.length > 2000) bad(`${who}: experience description`);
    }
    if (m.experience.length > 30) bad(`${who}: too many experience rows`);

    const seen = new Set<string>();
    const perKind = { skill: 0, interest: 0, mentorship_area: 0 };
    for (const t of m.tags) {
      if (t.name.length < 2 || t.name.length > 40) bad(`${who}: tag length "${t.name}"`);
      if (t.name !== t.name.trim()) bad(`${who}: tag not trimmed`);
      if (/[<>]/.test(t.name)) bad(`${who}: tag has markup`);
      const key = `${t.kind}:${t.name.toLowerCase()}`;
      if (seen.has(key)) bad(`${who}: duplicate tag ${t.name}`);
      seen.add(key);
      perKind[t.kind]++;
    }
    for (const kind of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      if (perKind[kind] > LIMITS[kind]) bad(`${who}: too many ${kind} tags`);
    }
    if (m.complete && (m.tags.length < 3 || m.tags.length > 10)) bad(`${who}: expected 3-10 tags, got ${m.tags.length}`);
  }

  const completed = new Set(plan.members.filter((m) => m.complete).map((m) => m.slug));
  const postIds = new Set<string>();
  const postHour = new Map<string, number[]>();
  for (const p of plan.posts) {
    if (postIds.has(p.id)) bad(`post ${p.id}: duplicate id`);
    postIds.add(p.id);
    if (!completed.has(p.authorSlug)) bad(`post ${p.id}: author is not a completed member`);
    if (!enumValues.category.includes(p.category)) bad(`post ${p.id}: category`);
    if (!/\S/.test(p.body) || p.body.length > POST_MAX_LENGTH) bad(`post ${p.id}: body`);
    const created = Date.parse(p.createdAt);
    if (!(created < nowMs)) bad(`post ${p.id}: created in the future`);
    if (p.editedAt !== null && !(Date.parse(p.editedAt) > created && Date.parse(p.editedAt) < nowMs))
      bad(`post ${p.id}: edited_at out of range`);
    (postHour.get(p.authorSlug) ?? postHour.set(p.authorSlug, []).get(p.authorSlug)!).push(created);
  }
  for (const [slug, times] of postHour) {
    for (const t of times) {
      if (times.filter((o) => o >= t && o < t + 60 * MINUTE).length > 20) bad(`${slug}: more than 20 posts in an hour`);
    }
  }

  const commentIds = new Set<string>();
  const commentHour = new Map<string, number[]>();
  const postTime = new Map(plan.posts.map((p) => [p.id, Date.parse(p.createdAt)]));
  for (const c of plan.comments) {
    if (commentIds.has(c.id)) bad(`comment ${c.id}: duplicate id`);
    commentIds.add(c.id);
    if (!postTime.has(c.postId)) bad(`comment ${c.id}: unknown post`);
    if (!completed.has(c.authorSlug)) bad(`comment ${c.id}: author is not a completed member`);
    if (!/\S/.test(c.body) || c.body.length > COMMENT_MAX_LENGTH) bad(`comment ${c.id}: body`);
    const created = Date.parse(c.createdAt);
    if (!(created > (postTime.get(c.postId) ?? Infinity))) bad(`comment ${c.id}: not after its post`);
    if (!(created < nowMs)) bad(`comment ${c.id}: created in the future`);
    (commentHour.get(c.authorSlug) ?? commentHour.set(c.authorSlug, []).get(c.authorSlug)!).push(created);
  }
  for (const [slug, times] of commentHour) {
    for (const t of times) {
      if (times.filter((o) => o >= t && o < t + 60 * MINUTE).length > 60) bad(`${slug}: more than 60 comments in an hour`);
    }
  }

  const likePairs = new Set<string>();
  for (const l of plan.likes) {
    const key = `${l.postId}:${l.userSlug}`;
    if (likePairs.has(key)) bad(`like ${key}: duplicate`);
    likePairs.add(key);
    if (!postTime.has(l.postId)) bad(`like ${key}: unknown post`);
    if (!completed.has(l.userSlug)) bad(`like ${key}: member is not completed`);
    if (!(Date.parse(l.createdAt) > (postTime.get(l.postId) ?? Infinity))) bad(`like ${key}: not after its post`);
    if (!(Date.parse(l.createdAt) < nowMs)) bad(`like ${key}: created in the future`);
  }

  return problems;
}

export const PAGE_SIZE = FEED_PAGE_SIZE;
