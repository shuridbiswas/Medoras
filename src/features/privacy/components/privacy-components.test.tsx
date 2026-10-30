import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  updatePrivacySettings: vi.fn(),
  requestAccountDeletion: vi.fn(),
  cancelAccountDeletion: vi.fn(),
}));
vi.mock("@/features/privacy/actions", () => actions);
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { PrivacySettingsForm, DeletionPanel } = await import("@/features/privacy/components/privacy-forms");

beforeEach(() => {
  vi.clearAllMocks();
  actions.requestAccountDeletion.mockResolvedValue({ ok: true });
  actions.cancelAccountDeletion.mockResolvedValue({ ok: true });
});

describe("PrivacySettingsForm", () => {
  it("shows the current choices", () => {
    render(<PrivacySettingsForm profileVisibility="connections" directoryListed={false} />);
    expect(screen.getByRole("radio", { name: /only my connections/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /every medyra member/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /list me in the member directory/i })).not.toBeChecked();
  });

  it("is honest about what each setting protects", () => {
    render(<PrivacySettingsForm profileVisibility="members" directoryListed />);
    expect(screen.getByText(/enforced in the database; your bio is hidden by the app/i)).toBeInTheDocument();
    expect(screen.getByText(/people who know your username can still open your profile/i)).toBeInTheDocument();
  });
});

describe("DeletionPanel", () => {
  it("explains the consequences and the waiting period before asking, and can be backed out of", async () => {
    const user = userEvent.setup();
    render(<DeletionPanel pending={null} />);
    await user.click(screen.getByRole("button", { name: /request account deletion/i }));
    expect(screen.getByText(/can't be undone after the 30-day waiting period/i)).toBeInTheDocument();
    expect(actions.requestAccountDeletion).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /keep my account/i }));
    expect(screen.getByRole("button", { name: /request account deletion/i })).toBeInTheDocument();
  });

  it("files the request and refreshes", async () => {
    const user = userEvent.setup();
    render(<DeletionPanel pending={null} />);
    await user.click(screen.getByRole("button", { name: /request account deletion/i }));
    await user.click(screen.getByRole("button", { name: /yes, request deletion/i }));
    expect(actions.requestAccountDeletion).toHaveBeenCalled();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("sends the member to confirm their password when their sign-in is too old", async () => {
    const user = userEvent.setup();
    actions.requestAccountDeletion.mockResolvedValue({ ok: false, error: "x", reauth: true });
    render(<DeletionPanel pending={null} />);
    await user.click(screen.getByRole("button", { name: /request account deletion/i }));
    await user.click(screen.getByRole("button", { name: /yes, request deletion/i }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/reauth?next=%2Fsettings%2Fprivacy"));
  });

  it("shows an open request with its date and lets the member cancel it", async () => {
    const user = userEvent.setup();
    render(<DeletionPanel pending={{ id: "r1", scheduledFor: "2026-12-02" }} />);
    expect(screen.getByRole("status")).toHaveTextContent(/deletion requested.*2026-12-02/i);
    expect(screen.queryByRole("button", { name: /request account deletion/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel the deletion request/i }));
    expect(actions.cancelAccountDeletion).toHaveBeenCalledWith("r1");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("shows a failure", async () => {
    const user = userEvent.setup();
    actions.cancelAccountDeletion.mockResolvedValue({ ok: false, error: "That request can't be cancelled any more." });
    render(<DeletionPanel pending={{ id: "r1", scheduledFor: "2026-12-02" }} />);
    await user.click(screen.getByRole("button", { name: /cancel the deletion request/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't be cancelled/);
  });
});
