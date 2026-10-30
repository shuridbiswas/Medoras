import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationItem } from "@/features/notifications/format";

const actions = vi.hoisted(() => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
  updateInAppPreferences: vi.fn(),
}));
vi.mock("@/features/notifications/actions", () => actions);
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/queries", () => ({ getUnreadCount: vi.fn() }));

const { NotificationList } = await import("@/features/notifications/components/notification-list");
const { BellLink } = await import("@/features/notifications/components/notification-bell");
const { InAppPreferencesForm } = await import("@/features/notifications/components/in-app-preferences-form");

const sam = { id: "u2", username: "sam_k", first_name: "Sam", last_name: "Kowalski", avatar_path: null };
const item = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "n1",
  type: "post_comment",
  entity_type: "post",
  entity_id: "p1",
  created_at: "2026-10-30T10:00:00Z",
  read_at: null,
  actor: sam,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  actions.markNotificationRead.mockResolvedValue({ ok: true, unread: 0 });
  actions.markAllNotificationsRead.mockResolvedValue({ ok: true, unread: 0 });
  actions.deleteNotification.mockResolvedValue({ ok: true, unread: 0 });
});

describe("NotificationList", () => {
  it("reads as a sentence about who did what, never showing any post or comment text", () => {
    render(
      <NotificationList
        items={[
          item(),
          item({ id: "n2", type: "connection_request", entity_type: "connection", entity_id: "c1" }),
          item({ id: "n3", type: "comment_reply" }),
        ]}
      />,
    );
    expect(screen.getByText("commented on your post", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("sent you a connection request", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("also commented on a post you commented on", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("Sam Kowalski")).toHaveLength(3);
    expect(screen.getByText("3 unread")).toBeInTheDocument();
  });

  it("marks a notification read and opens where it happened", async () => {
    const user = userEvent.setup();
    render(<NotificationList items={[item()]} />);
    await user.click(screen.getByRole("button", { name: /sam kowalski commented on your post/i }));
    expect(actions.markNotificationRead).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/post/p1"));
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });

  it("opens connection requests on the requests page", async () => {
    const user = userEvent.setup();
    render(
      <NotificationList
        items={[item({ type: "connection_request", entity_type: "connection", entity_id: "c1" })]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /sent you a connection request/i }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/network/requests"));
  });

  it("does not mark an already-read notification again", async () => {
    const user = userEvent.setup();
    render(<NotificationList items={[item({ read_at: "2026-10-30T11:00:00Z" })]} />);
    expect(screen.getByText("Everything is read")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /commented on your post/i }));
    expect(actions.markNotificationRead).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/post/p1");
  });

  it("marks everything read in one go", async () => {
    const user = userEvent.setup();
    render(<NotificationList items={[item(), item({ id: "n2" })]} />);
    await user.click(screen.getByRole("button", { name: /mark all as read/i }));
    expect(actions.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Everything is read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeDisabled();
  });

  it("dismisses one notification", async () => {
    const user = userEvent.setup();
    render(<NotificationList items={[item(), item({ id: "n2", type: "connection_accepted", entity_type: "connection" })]} />);
    const rows = screen.getAllByRole("listitem");
    await user.click(within(rows[0]).getByRole("button", { name: /dismiss notification from sam kowalski/i }));
    expect(actions.deleteNotification).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
  });

  it("shows a calm empty state", () => {
    render(<NotificationList items={[]} />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  });

  it("surfaces a failure to mark everything read", async () => {
    const user = userEvent.setup();
    actions.markAllNotificationsRead.mockResolvedValue({ ok: false, error: "Something went wrong. Please try again." });
    render(<NotificationList items={[item()]} />);
    await user.click(screen.getByRole("button", { name: /mark all as read/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/went wrong/);
  });

  it("copes with a notification whose actor was removed", () => {
    render(<NotificationList items={[item({ actor: null })]} />);
    expect(screen.getByText("A member")).toBeInTheDocument();
  });
});

describe("BellLink", () => {
  it("links to the inbox and shows no badge when nothing is unread", () => {
    render(<BellLink unread={0} />);
    const link = screen.getByRole("link", { name: "Notifications" });
    expect(link).toHaveAttribute("href", "/notifications");
    expect(link.textContent).toBe("");
  });

  it("announces the unread count and caps the visible badge", () => {
    const { rerender } = render(<BellLink unread={3} />);
    expect(screen.getByRole("link", { name: "Notifications, 3 unread" })).toHaveTextContent("3");
    rerender(<BellLink unread={25} />);
    expect(screen.getByRole("link", { name: "Notifications, 25 unread" })).toHaveTextContent("9+");
  });
});

describe("InAppPreferencesForm", () => {
  it("shows the current choices and says notifications never include what people wrote", () => {
    render(<InAppPreferencesForm inappConnections={false} inappComments />);
    expect(screen.getByRole("checkbox", { name: /connection requests/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /comments and replies/i })).toBeChecked();
    expect(screen.getByText(/never what they wrote/i)).toBeInTheDocument();
  });
});
