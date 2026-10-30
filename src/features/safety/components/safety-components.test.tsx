import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  submitReport: vi.fn(),
  setMute: vi.fn(),
  submitAppeal: vi.fn(),
}));
vi.mock("@/features/safety/actions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { ReportButton } = await import("@/features/safety/components/report-button");
const { MuteButton } = await import("@/features/safety/components/mute-button");
const { ModerationNotices } = await import("@/features/safety/components/notices");

beforeEach(() => {
  vi.clearAllMocks();
  actions.submitReport.mockResolvedValue({ ok: true });
  actions.setMute.mockResolvedValue({ ok: true });
  actions.submitAppeal.mockResolvedValue({ status: "success", message: "Your appeal was sent. A person will review it." });
});

describe("ReportButton", () => {
  it("opens a form with every reason, honest limits and an emergency pointer", async () => {
    const user = userEvent.setup();
    render(<ReportButton targetType="post" targetId="p1" />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /report/i }));
    expect(screen.getAllByRole("radio")).toHaveLength(9);
    expect(screen.getByText(/nothing is screened automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/immediate danger, contact your local emergency number/i)).toBeInTheDocument();
    expect(screen.getByText(/not a crisis service/i)).toBeInTheDocument();
  });

  it("will not send until a reason is chosen, then sends the report for this item", async () => {
    const user = userEvent.setup();
    render(<ReportButton targetType="comment" targetId="c1" />);
    await user.click(screen.getByRole("button", { name: /report/i }));
    const send = screen.getByRole("button", { name: /send report/i });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /harassment or bullying/i }));
    await user.type(screen.getByLabelText(/anything we should know/i), "Rude to a student");
    await user.click(send);
    expect(actions.submitReport).toHaveBeenCalledWith({
      targetType: "comment",
      targetId: "c1",
      reason: "harassment",
      details: "Rude to a student",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/a person on the Medyra team will review/i);
    expect(screen.getByText(/doesn't remove anything by itself/i)).toBeInTheDocument();
  });

  it("shows an error and keeps the form when the report fails", async () => {
    const user = userEvent.setup();
    actions.submitReport.mockResolvedValue({ ok: false, error: "You can't report your own content." });
    render(<ReportButton targetType="profile" targetId="m1" label="Report this member" />);
    await user.click(screen.getByRole("button", { name: /report this member/i }));
    await user.click(screen.getByRole("radio", { name: /impersonation/i }));
    await user.click(screen.getByRole("button", { name: /send report/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/own content/);
    expect(screen.getByRole("button", { name: /send report/i })).toBeInTheDocument();
  });

  it("can be cancelled, and announces whether the form is open", async () => {
    const user = userEvent.setup();
    render(<ReportButton targetType="post" targetId="p1" />);
    const toggle = screen.getByRole("button", { name: /^report$/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("MuteButton", () => {
  it("mutes, refreshes the page, and says what it does by name", async () => {
    const user = userEvent.setup();
    render(<MuteButton memberId="m1" name="Sam" />);
    await user.click(screen.getByRole("button", { name: "Mute Sam" }));
    expect(actions.setMute).toHaveBeenCalledWith("m1", true);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("unmutes when already muted, in the list style too", async () => {
    const user = userEvent.setup();
    render(<MuteButton memberId="m1" name="Sam" muted variant="list" />);
    await user.click(screen.getByRole("button", { name: "Unmute Sam" }));
    expect(actions.setMute).toHaveBeenCalledWith("m1", false);
  });

  it("shows a failure", async () => {
    const user = userEvent.setup();
    actions.setMute.mockResolvedValue({ ok: false, error: "Something went wrong. Please try again." });
    render(<MuteButton memberId="m1" name="Sam" />);
    await user.click(screen.getByRole("button", { name: "Mute Sam" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/went wrong/);
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("ModerationNotices", () => {
  const notice = (over: Record<string, unknown> = {}) => ({
    id: "n1",
    member_id: "u1",
    kind: "warning" as const,
    message: "Please keep comments respectful.",
    created_at: "2026-11-02T10:00:00Z",
    appeal: null,
    ...over,
  });

  it("renders nothing when there are no notices", () => {
    const { container } = render(<ModerationNotices notices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the message to the member and offers an appeal for decisions against them", async () => {
    const user = userEvent.setup();
    render(<ModerationNotices notices={[notice(), notice({ id: "n2", kind: "restored", message: "Welcome back." })]} />);
    expect(screen.getByText("Please keep comments respectful.")).toBeInTheDocument();
    // Only the warning can be appealed; a restoration cannot.
    expect(screen.getAllByRole("button", { name: /appeal this decision/i })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /appeal this decision/i }));
    expect(screen.getByLabelText(/why do you disagree/i)).toBeInTheDocument();
    expect(document.querySelector("input[name=noticeId]")).toHaveValue("n1");
  });

  it("shows the state of an existing appeal instead of the button", () => {
    render(
      <ModerationNotices
        notices={[
          notice({ appeal: { status: "open", decision_note: null } }),
          notice({ id: "n2", kind: "suspended", appeal: { status: "overturned", decision_note: "Our mistake." } }),
        ]}
      />,
    );
    expect(screen.queryByRole("button", { name: /appeal this decision/i })).not.toBeInTheDocument();
    expect(screen.getByText(/appeal sent\. a person will review it/i)).toBeInTheDocument();
    expect(screen.getByText(/the decision was overturned/i)).toBeInTheDocument();
    expect(screen.getByText(/our mistake/i)).toBeInTheDocument();
  });
});
