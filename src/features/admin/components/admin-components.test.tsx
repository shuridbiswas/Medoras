import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  claimReport: vi.fn(),
  moderateReport: vi.fn(),
  setMemberStatus: vi.fn(),
  decideAppeal: vi.fn(),
  executeDeletion: vi.fn(),
  setRetention: vi.fn(),
}));
vi.mock("@/features/admin/actions", () => actions);
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const forms = await import("@/features/admin/components/admin-forms");
const { AdminNav, AdminNotice } = await import("@/features/admin/components/admin-nav");

beforeEach(() => {
  vi.clearAllMocks();
  actions.claimReport.mockResolvedValue({ ok: true });
  actions.executeDeletion.mockResolvedValue({ ok: true });
  actions.moderateReport.mockResolvedValue({ status: "success", message: "Decision recorded." });
});

describe("AdminNotice and AdminNav", () => {
  it("says plainly that moderation is done by people, not AI", () => {
    render(<AdminNotice />);
    expect(screen.getByText(/no automated or AI moderation/i)).toBeInTheDocument();
    expect(screen.getByText(/recorded in the audit log/i)).toBeInTheDocument();
  });

  it("links the three admin areas and marks the current one", () => {
    render(<AdminNav current="reports" />);
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute("href", "/admin/users");
  });
});

describe("ReportDecisionForm", () => {
  it("starts as a dismissal and asks for a member message only for decisions that affect them", async () => {
    const user = userEvent.setup();
    render(<forms.ReportDecisionForm reportId="r1" targetType="post" />);
    expect(screen.queryByLabelText(/message to the member/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Decision"), "warn");
    expect(screen.getByLabelText(/message to the member/i)).toBeInTheDocument();
    expect(document.querySelector("input[name=reportId]")).toHaveValue("r1");
  });

  it("offers removal only for posts and comments, never for a profile", () => {
    const { rerender } = render(<forms.ReportDecisionForm reportId="r1" targetType="post" />);
    expect(screen.getByRole("option", { name: /remove the post/i })).toBeInTheDocument();
    rerender(<forms.ReportDecisionForm reportId="r1" targetType="comment" />);
    expect(screen.getByRole("option", { name: /remove the comment/i })).toBeInTheDocument();
    rerender(<forms.ReportDecisionForm reportId="r1" targetType="profile" />);
    expect(screen.queryByRole("option", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("keeps the internal note separate from the member's message", async () => {
    const user = userEvent.setup();
    render(<forms.ReportDecisionForm reportId="r1" targetType="post" />);
    await user.selectOptions(screen.getByLabelText("Decision"), "suspend");
    expect(screen.getByLabelText(/internal note \(staff only\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/they will see this and can appeal/i)).toBeInTheDocument();
  });
});

describe("MemberStatusForm", () => {
  it("offers to suspend an active member and to restore a suspended one, with a message either way", () => {
    const { rerender } = render(<forms.MemberStatusForm memberId="m1" status="active" name="Sam" />);
    expect(screen.getByRole("button", { name: /suspend member/i })).toBeInTheDocument();
    expect(document.querySelector("input[name=status]")).toHaveValue("suspended");
    rerender(<forms.MemberStatusForm memberId="m1" status="suspended" name="Sam" />);
    expect(screen.getByRole("button", { name: /restore member/i })).toBeInTheDocument();
    expect(document.querySelector("input[name=status]")).toHaveValue("active");
    expect(screen.getByLabelText(/^message to sam/i)).toBeInTheDocument();
  });
});

describe("ClaimButton", () => {
  it("claims the report and refreshes", async () => {
    const user = userEvent.setup();
    render(<forms.ClaimButton reportId="r1" />);
    await user.click(screen.getByRole("button", { name: /start review/i }));
    expect(actions.claimReport).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("shows why it failed", async () => {
    const user = userEvent.setup();
    actions.claimReport.mockResolvedValue({ ok: false, error: "That report is not open." });
    render(<forms.ClaimButton reportId="r1" />);
    await user.click(screen.getByRole("button", { name: /start review/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That report is not open.");
  });
});

describe("DeletionButton", () => {
  it("cannot be used before the cooling-off period ends", () => {
    render(<forms.DeletionButton requestId="d1" due={false} name="Sam" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/cooling-off period not over/i)).toBeInTheDocument();
  });

  it("asks for confirmation before permanently deleting, and can be cancelled", async () => {
    const user = userEvent.setup();
    render(<forms.DeletionButton requestId="d1" due name="Sam" />);
    await user.click(screen.getByRole("button", { name: "Delete Sam's account" }));
    expect(screen.getByText(/permanently delete Sam's account and content/i)).toBeInTheDocument();
    expect(actions.executeDeletion).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete Sam's account" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Sam's account" }));
    await user.click(screen.getByRole("button", { name: /yes, delete/i }));
    expect(actions.executeDeletion).toHaveBeenCalledWith("d1");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });
});

describe("RetentionForm", () => {
  it("shows the current number of days with an accessible label", () => {
    render(<forms.RetentionForm policy={{ key: "audit_logs", days: 730, description: "Audit log entries are deleted after this many days." }} />);
    expect(screen.getByLabelText("Days to keep audit logs")).toHaveValue(730);
    expect(screen.getByText(/deleted after this many days/i)).toBeInTheDocument();
  });
});
