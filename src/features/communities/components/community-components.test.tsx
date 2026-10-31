import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const actions = {
  joinCommunity: vi.fn(async () => ({ ok: true })),
  leaveCommunity: vi.fn(async () => ({ ok: true })),
  requestToJoin: vi.fn(async () => ({ ok: true })),
  withdrawRequest: vi.fn(async () => ({ ok: true })),
  decideRequest: vi.fn(async () => ({ ok: true })),
  setMemberRole: vi.fn(async () => ({ ok: true })),
  setMemberBan: vi.fn(async () => ({ ok: true })),
  createAnnouncement: vi.fn(),
  deleteAnnouncement: vi.fn(async () => ({ ok: true })),
  removeCommunityPost: vi.fn(async () => ({ ok: true })),
  createCommunity: vi.fn(),
  updateCommunity: vi.fn(),
};

vi.mock("@/features/communities/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { JoinPanel } = await import("@/features/communities/components/join-panel");
const { MemberControls } = await import("@/features/communities/components/staff-controls");
const { ModeratorRemovePost } = await import("@/features/communities/components/moderator-remove");
const { CommunityForm } = await import("@/features/communities/components/community-form");
const { CommunityCard } = await import("@/features/communities/components/community-card");

beforeEach(() => vi.clearAllMocks());

describe("JoinPanel", () => {
  it("joins a public community straight away", async () => {
    const user = userEvent.setup();
    render(<JoinPanel communityId="c1" visibility="public" role={null} requestPending={false} />);
    await user.click(screen.getByRole("button", { name: /join community/i }));
    expect(actions.joinCommunity).toHaveBeenCalledWith("c1");
    expect(refresh).toHaveBeenCalled();
  });

  it("asks to join a private community with an optional message", async () => {
    const user = userEvent.setup();
    render(<JoinPanel communityId="c1" visibility="private" role={null} requestPending={false} />);
    expect(screen.queryByRole("button", { name: /join community/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /ask to join/i }));
    await user.type(screen.getByLabelText(/why you'd like to join/i), "I teach there");
    await user.click(screen.getByRole("button", { name: /send request/i }));
    expect(actions.requestToJoin).toHaveBeenCalledWith("c1", "I teach there");
  });

  it("shows a pending request with a way to withdraw it", async () => {
    const user = userEvent.setup();
    render(<JoinPanel communityId="c1" visibility="private" role={null} requestPending />);
    expect(screen.getByText(/waiting for a moderator/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /withdraw request/i }));
    expect(actions.withdrawRequest).toHaveBeenCalledWith("c1");
  });

  it("lets a member leave after confirming, and tells the owner they own it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<JoinPanel communityId="c1" visibility="private" role="member" requestPending={false} />);
    await user.click(screen.getByRole("button", { name: /leave community/i }));
    await user.click(screen.getByRole("button", { name: /yes, leave/i }));
    expect(actions.leaveCommunity).toHaveBeenCalledWith("c1");
    rerender(<JoinPanel communityId="c1" visibility="private" role="owner" requestPending={false} />);
    expect(screen.getByText(/you own this community/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /leave/i })).toBeNull();
  });

  it("shows a refusal from the server", async () => {
    const user = userEvent.setup();
    actions.joinCommunity.mockResolvedValueOnce({ ok: false, error: "You can't join this community." } as never);
    render(<JoinPanel communityId="c1" visibility="public" role={null} requestPending={false} />);
    await user.click(screen.getByRole("button", { name: /join community/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You can't join this community.");
  });
});

describe("MemberControls", () => {
  it("lets the owner promote a member and remove them with a reason", async () => {
    const user = userEvent.setup();
    render(<MemberControls communityId="c1" memberId="m1" name="Bob" targetRole="member" viewerRole="owner" />);
    await user.click(screen.getByRole("button", { name: /make bob a moderator/i }));
    expect(actions.setMemberRole).toHaveBeenCalledWith("c1", "m1", "moderator");

    await user.click(screen.getByRole("button", { name: /remove bob/i }));
    expect(screen.getByRole("button", { name: /remove member/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/reason/i), "spam");
    await user.click(screen.getByRole("button", { name: /remove member/i }));
    expect(actions.setMemberBan).toHaveBeenCalledWith("c1", "m1", true, "spam");
  });

  it("gives a moderator no role controls, and no way to remove another moderator or the owner", () => {
    const { rerender, container } = render(<MemberControls communityId="c1" memberId="m1" name="Bob" targetRole="member" viewerRole="moderator" />);
    expect(screen.queryByRole("button", { name: /moderator/i })).toBeNull();
    expect(screen.getByRole("button", { name: /remove bob/i })).toBeInTheDocument();
    rerender(<MemberControls communityId="c1" memberId="m2" name="Cara" targetRole="moderator" viewerRole="moderator" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<MemberControls communityId="c1" memberId="m3" name="Alice" targetRole="owner" viewerRole="owner" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ModeratorRemovePost", () => {
  it("needs a reason before removing a post and reports it as removed", async () => {
    const user = userEvent.setup();
    const onRemoved = vi.fn();
    render(<ModeratorRemovePost postId="p1" onRemoved={onRemoved} />);
    await user.click(screen.getByRole("button", { name: /remove as moderator/i }));
    expect(screen.getByRole("button", { name: /remove post/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/reason/i), "privacy");
    await user.click(screen.getByRole("button", { name: /remove post/i }));
    expect(actions.removeCommunityPost).toHaveBeenCalledWith("p1", "privacy");
    expect(onRemoved).toHaveBeenCalledWith("p1");
  });
});

describe("CommunityForm and CommunityCard", () => {
  it("explains what private means before creating, and keeps typed values when saving fails", async () => {
    const user = userEvent.setup();
    actions.createCommunity.mockResolvedValue({ status: "error", message: "Please fix the highlighted fields.", fieldErrors: { name: ["Give the community a name of at least 3 characters."] } });
    render(<CommunityForm />);
    expect(screen.getByText(/posts, announcements and the member list are visible to members only/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^name/i), "ab");
    await user.type(screen.getByLabelText(/what is this community for/i), "A place for nurses");
    await user.click(screen.getByRole("button", { name: /create community/i }));
    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name/i)).toHaveValue("ab");
    expect(screen.getByLabelText(/what is this community for/i)).toHaveValue("A place for nurses");
  });

  it("shows a private community card without a member count the viewer is not allowed to see", () => {
    render(
      <CommunityCard
        community={{
          id: "c1",
          slug: "nursing-educators",
          name: "Nursing educators",
          description: "A place for people who teach nursing students.",
          kind: "profession",
          visibility: "private",
          institution: null,
          region_label: "Montreal",
          country: "CA",
          created_at: "2026-11-03T10:00:00Z",
          memberCount: null,
          role: null,
          requestPending: true,
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "Nursing educators" })).toHaveAttribute("href", "/communities/nursing-educators");
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Request sent")).toBeInTheDocument();
    expect(screen.queryByText(/members?$/)).toBeNull();
  });
});
