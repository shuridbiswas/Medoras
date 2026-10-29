import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProfileHeader } from "@/features/profile/components/profile-header";
import { ProfileTabs } from "@/features/profile/components/profile-tabs";
import {
  AboutSection,
  CompletenessCard,
  EducationSection,
  ExperienceSection,
  MentorshipCard,
  SkillsSection,
} from "@/features/profile/components/sections";
import type { PublicProfile } from "@/features/profile/visibility";

const profile: PublicProfile = {
  id: "u1",
  username: "amina_r",
  first_name: "Amina",
  last_name: "Rahman",
  headline: "Psychology student",
  bio: null,
  avatar_path: null,
  cover_path: null,
  location_label: "Montreal, QC",
  professional_journey: null,
  career_aspirations: null,
  looking_for_mentorship: false,
  open_to_mentor: false,
  member_type: "undergraduate_student",
  fields: ["psychology", "public_health"],
  institution: "University of Montreal",
  qualification: "BSc Psychology",
  specialty: null,
  career_stage: "student",
  country: "CA",
  created_at: "2026-01-01",
};

describe("ProfileHeader", () => {
  it("shows the identity details and an Edit Profile link only to the owner", () => {
    const { rerender } = render(
      <ProfileHeader
        profile={profile}
        isOwner
        avatarSrc={null}
        coverSrc={null}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Amina Rahman" }),
    ).toBeInTheDocument();
    expect(screen.getByText("@amina_r")).toBeInTheDocument();
    expect(screen.getByText("Montreal, QC, Canada")).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.getByText("Psychology")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute(
      "href",
      "/profile/edit",
    );

    rerender(
      <ProfileHeader
        profile={profile}
        isOwner={false}
        avatarSrc={null}
        coverSrc={null}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /edit profile/i }),
    ).not.toBeInTheDocument();
  });

  it("copes with an incomplete profile (no headline, location, fields or photo)", () => {
    const sparse = {
      ...profile,
      headline: null,
      location_label: null,
      country: null,
      fields: [],
      institution: null,
      qualification: null,
      career_stage: null,
    };
    render(
      <ProfileHeader
        profile={sparse}
        isOwner={false}
        avatarSrc={null}
        coverSrc={null}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Amina Rahman",
    );
    expect(screen.queryByLabelText("Fields")).not.toBeInTheDocument();
  });

  it("never renders an email address", () => {
    const { container } = render(
      <ProfileHeader
        profile={profile}
        isOwner
        avatarSrc={null}
        coverSrc={null}
      />,
    );
    expect(container.textContent).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
  });
});

describe("ProfileTabs (accessible tab navigation)", () => {
  const tabs = [
    { id: "a", label: "Overview", panel: <p>Panel A</p> },
    { id: "b", label: "Education", count: 2, panel: <p>Panel B</p> },
    { id: "c", label: "Activity", panel: <p>Panel C</p> },
  ];

  it("exposes tablist, tab and tabpanel roles and shows one panel at a time", () => {
    render(<ProfileTabs tabs={tabs} />);
    expect(
      screen.getByRole("tablist", { name: "Profile sections" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /overview/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel A");
    expect(screen.getByText("Panel B")).not.toBeVisible();
  });

  it("switches with clicks and arrow, Home and End keys using roving focus", async () => {
    const user = userEvent.setup();
    render(<ProfileTabs tabs={tabs} />);

    await user.click(screen.getByRole("tab", { name: /education/i }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel B");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /activity/i })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel C");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /overview/i })).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /activity/i })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /overview/i })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /activity/i })).toHaveFocus();

    expect(screen.getByRole("tab", { name: /overview/i })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});

describe("empty states and owner nudges", () => {
  it("invite the owner to add content with working links", () => {
    render(
      <>
        <AboutSection profile={profile} skills={[]} isOwner />
        <EducationSection items={[]} isOwner firstName="Amina" />
        <ExperienceSection items={[]} isOwner firstName="Amina" />
        <SkillsSection skills={[]} isOwner firstName="Amina" />
      </>,
    );
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/profile/edit#about",
      "/profile/edit#education",
      "/profile/edit#experience",
      "/profile/edit#skills",
    ]);
  });

  it("speak to visitors without edit links", () => {
    render(
      <>
        <EducationSection items={[]} isOwner={false} firstName="Amina" />
      </>,
    );
    expect(
      screen.getByText(/Amina hasn't added education yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows mentorship as self-reported, not verified", () => {
    render(
      <MentorshipCard
        profile={{
          ...profile,
          looking_for_mentorship: true,
          open_to_mentor: true,
        }}
        skills={[
          {
            id: "s1",
            profile_id: "u1",
            name: "Clinical placements",
            kind: "mentorship_area",
            created_at: "",
          },
        ]}
        isOwner={false}
      />,
    );
    expect(screen.getByText("Looking for mentorship")).toBeInTheDocument();
    expect(
      screen.getByText("Interested in becoming a mentor"),
    ).toBeInTheDocument();
    expect(screen.getByText("Clinical placements")).toBeInTheDocument();
    expect(screen.getByText(/self-reported/i)).toBeInTheDocument();
    expect(
      screen.getByText(/not verified professional credentials/i),
    ).toBeInTheDocument();
  });

  it("does not invent verification badges", () => {
    const { container } = render(
      <>
        <MentorshipCard profile={profile} skills={[]} isOwner={false} />
        <SkillsSection
          skills={[
            {
              id: "s",
              profile_id: "u1",
              name: "Triage",
              kind: "skill",
              created_at: "",
            },
          ]}
          isOwner={false}
          firstName="Amina"
        />
      </>,
    );
    expect(container.textContent?.toLowerCase()).not.toMatch(
      /(?<!not )verified (professional|badge|member)|licensed|certified by/,
    );
  });

  it("lists completeness steps for the owner and hides once complete", () => {
    const { rerender, container } = render(
      <CompletenessCard
        profile={profile}
        education={[]}
        experience={[]}
        skills={[]}
      />,
    );
    expect(screen.getByText(/0 of 6 done/)).toBeInTheDocument();

    const full = { ...profile, avatar_path: "a", cover_path: "c", bio: "b" };
    rerender(
      <CompletenessCard
        profile={full}
        education={[{ id: "e" } as never]}
        experience={[{ id: "x" } as never]}
        skills={[
          {
            id: "s",
            profile_id: "u1",
            name: "Triage",
            kind: "skill",
            created_at: "",
          },
        ]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
