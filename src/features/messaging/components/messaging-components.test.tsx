import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const push = vi.fn();
const actions = {
  sendMessage: vi.fn(async () => ({ ok: true })),
  deleteMessage: vi.fn(async () => ({ ok: true })),
  markRead: vi.fn(async () => ({ ok: true })),
  respondToRequest: vi.fn(async () => ({ ok: true })),
  leaveConversation: vi.fn(async () => ({ ok: true })),
  addGroupMember: vi.fn(async () => ({ ok: true })),
  startConversation: vi.fn(),
  createGroup: vi.fn(),
};
const subscribe = vi.fn();
let realtime: "ok" | "throws" = "ok";

vi.mock("@/features/messaging/actions", () => actions);
vi.mock("@/features/safety/actions", () => ({ submitReport: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    if (realtime === "throws") throw new Error("Supabase is not configured");
    const channel = { on: vi.fn(() => channel), subscribe: (cb: (s: string) => void) => (subscribe(cb), channel) };
    return { channel: vi.fn(() => channel), removeChannel: vi.fn() };
  },
}));

const { Thread } = await import("@/features/messaging/components/thread");
const { RequestBanner, NewGroupForm } = await import("@/features/messaging/components/controls");
const { ConversationList } = await import("@/features/messaging/components/conversation-list");

const other = { id: "u2", username: "bob_b", first_name: "Bob", last_name: "B", headline: null, avatar_path: null };
const messages = [
  { id: "m1", body: "Hello Bob", created_at: "2026-11-02T10:00:00Z", mine: true, sender: null },
  { id: "m2", body: "Hi there", created_at: "2026-11-02T10:01:00Z", mine: false, sender: other },
];

beforeEach(() => {
  vi.clearAllMocks();
  realtime = "ok";
  Element.prototype.scrollIntoView = vi.fn();
});

describe("Thread", () => {
  it("shows the conversation, marks it read, and lets the sender delete only their own message", async () => {
    render(<Thread conversationId="c1" messages={messages} canSend group={false} />);
    expect(screen.getByText("Hello Bob")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
    expect(actions.markRead).toHaveBeenCalledWith("c1");
    expect(screen.getAllByRole("button", { name: /delete this message/i })).toHaveLength(1);
    // Messages from others can be reported.
    expect(screen.getByRole("button", { name: /report/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /delete this message/i }));
    expect(actions.deleteMessage).toHaveBeenCalledWith("m1");
  });

  it("sends a message, clears the box and refreshes, and keeps the text when sending fails", async () => {
    const user = userEvent.setup();
    render(<Thread conversationId="c1" messages={messages} canSend group={false} />);
    await user.type(screen.getByLabelText("Write a message"), "On my way");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    expect(actions.sendMessage).toHaveBeenCalledWith("c1", "On my way");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByLabelText("Write a message")).toHaveValue("");

    actions.sendMessage.mockResolvedValueOnce({ ok: false, error: "This person has not accepted your message request yet." } as never);
    await user.type(screen.getByLabelText("Write a message"), "Another one");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not accepted your message request/i);
    expect(screen.getByLabelText("Write a message")).toHaveValue("Another one");
  });

  it("replaces the composer with the reason when sending is not allowed", () => {
    render(<Thread conversationId="c1" messages={messages} canSend={false} lockedReason="Accept the request above to reply." group={false} />);
    expect(screen.queryByLabelText("Write a message")).toBeNull();
    expect(screen.getByText("Accept the request above to reply.")).toBeInTheDocument();
  });

  it("still works when Realtime is unavailable, and subscribes when it is", () => {
    realtime = "throws";
    const { unmount } = render(<Thread conversationId="c1" messages={messages} canSend group={false} />);
    expect(screen.getByText("Hi there")).toBeInTheDocument();
    unmount();
    realtime = "ok";
    render(<Thread conversationId="c1" messages={messages} canSend group={false} />);
    expect(subscribe).toHaveBeenCalled();
  });

  it("names the sender in a group", () => {
    render(<Thread conversationId="c1" messages={messages} canSend group />);
    expect(screen.getByRole("link", { name: "Bob B" })).toHaveAttribute("href", "/profile/bob_b");
  });
});

describe("message request and group controls", () => {
  it("accepts a request and refreshes; declining returns to the requests list", async () => {
    const user = userEvent.setup();
    render(<RequestBanner conversationId="c1" />);
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(actions.respondToRequest).toHaveBeenCalledWith("c1", true);
    expect(refresh).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Decline" }));
    expect(actions.respondToRequest).toHaveBeenLastCalledWith("c1", false);
    expect(push).toHaveBeenCalledWith("/messages?tab=requests");
  });

  it("builds groups only from connections", async () => {
    const user = userEvent.setup();
    actions.createGroup.mockResolvedValue({ ok: true, conversationId: "g1" });
    const { rerender } = render(<NewGroupForm people={[]} />);
    expect(screen.getByText(/made from your connections/i)).toBeInTheDocument();
    rerender(<NewGroupForm people={[other]} />);
    expect(screen.getByRole("button", { name: /create group/i })).toBeDisabled();
    await user.type(screen.getByLabelText("Group name"), "Study group");
    await user.click(screen.getByRole("checkbox", { name: "Bob B" }));
    await user.click(screen.getByRole("button", { name: /create group/i }));
    expect(actions.createGroup).toHaveBeenCalledWith("Study group", ["u2"]);
    expect(push).toHaveBeenCalledWith("/messages/g1");
  });
});

describe("ConversationList", () => {
  it("links each conversation, shows unread counts and previews", () => {
    render(
      <ConversationList
        items={[
          { id: "c1", kind: "direct", title: null, status: "active", last_message_at: "2026-11-02T10:00:00Z", unread: 3, last: { body: "See you then", created_at: "2026-11-02T10:00:00Z", mine: false }, others: [other] },
          { id: "c2", kind: "group", title: "Study group", status: "active", last_message_at: "2026-11-01T10:00:00Z", unread: 0, last: { body: "Notes attached", created_at: "2026-11-01T10:00:00Z", mine: true }, others: [other] },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Bob B/ })).toHaveAttribute("href", "/messages/c1");
    expect(screen.getByText("3 unread messages")).toBeInTheDocument();
    expect(screen.getByText("You: Notes attached")).toBeInTheDocument();
    expect(screen.getByText("Study group")).toBeInTheDocument();
  });
});
