import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedComment, FeedPost } from "@/features/feed/types";

const actions = vi.hoisted(() => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  deletePost: vi.fn(),
  setLike: vi.fn(),
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  loadComments: vi.fn(),
  loadMorePosts: vi.fn(),
}));
vi.mock("@/features/feed/actions", () => actions);

const { PostCard } = await import("@/features/feed/components/post-card");
const { FeedList } = await import("@/features/feed/components/feed-list");
const { PostComposer } = await import("@/features/feed/components/post-composer");
const { FeedNav } = await import("@/features/feed/components/feed-nav");
const { formatRelative } = await import("@/components/relative-time");

const post = (over: Partial<FeedPost> = {}): FeedPost => ({
  id: "p1",
  category: "career_journey",
  body: "Finished my first placement.",
  created_at: "2026-10-28T12:00:00.000Z",
  edited_at: null,
  author: {
    id: "u2",
    username: "sam_k",
    first_name: "Sam",
    last_name: "Kowalski",
    headline: "Social work student",
    avatar_path: null,
  },
  likeCount: 2,
  commentCount: 1,
  likedByMe: false,
  isOwn: false,
  ...over,
});

const comment = (over: Partial<FeedComment> = {}): FeedComment => ({
  id: "c1",
  post_id: "p1",
  body: "Congratulations!",
  created_at: "2026-10-28T13:00:00.000Z",
  author: post().author,
  isOwn: false,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostCard", () => {
  it("shows the author, headline, category, text and a link to their real profile", () => {
    render(<PostCard post={post()} onDeleted={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Sam Kowalski" })).toHaveAttribute(
      "href",
      "/profile/sam_k",
    );
    expect(screen.getByText("Social work student")).toBeInTheDocument();
    expect(screen.getByText("Career Journey")).toBeInTheDocument();
    expect(screen.getByText("Finished my first placement.")).toBeInTheDocument();
    expect(screen.queryByText(/Edited/)).not.toBeInTheDocument();
  });

  it("shows an Edited marker for edited posts", () => {
    render(
      <PostCard post={post({ edited_at: "2026-10-29T00:00:00Z" })} onDeleted={vi.fn()} />,
    );
    expect(screen.getByText(/Edited/)).toBeInTheDocument();
  });

  it("keeps the member's edits when saving fails", async () => {
    const user = userEvent.setup();
    actions.updatePost.mockResolvedValue({ status: "error", message: "Something went wrong. Please try again." });
    render(<PostCard post={post({ isOwn: true })} onDeleted={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /edit your post/i }));
    const box = screen.getByRole("textbox", { name: /edit your post/i });
    await user.clear(box);
    await user.type(box, "Half-finished thought");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/went wrong/);
    expect(box).toHaveValue("Half-finished thought");
  });

  it("renders post text as text, never as markup", () => {
    const { container } = render(
      <PostCard
        post={post({ body: '<img src=x onerror="alert(1)"> <b>bold</b>' })}
        onDeleted={vi.fn()}
      />,
    );
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(/<b>bold<\/b>/)).toBeInTheDocument();
  });

  it("offers edit and delete only on the member's own posts", () => {
    const { unmount } = render(<PostCard post={post()} onDeleted={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /edit your post/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete your post/i })).not.toBeInTheDocument();
    unmount();
    render(<PostCard post={post({ isOwn: true })} onDeleted={vi.fn()} />);
    expect(screen.getByRole("button", { name: /edit your post/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete your post/i })).toBeInTheDocument();
  });

  describe("likes", () => {
    it("updates immediately, then settles on the server's count", async () => {
      const user = userEvent.setup();
      let resolve!: (v: unknown) => void;
      actions.setLike.mockReturnValue(new Promise((r) => (resolve = r)));
      render(<PostCard post={post()} onDeleted={vi.fn()} />);

      const button = screen.getByRole("button", { name: /like this post\. 2 likes/i });
      expect(button).toHaveAttribute("aria-pressed", "false");
      await user.click(button);

      // Optimistic: pressed and +1 before the server answers.
      const pressed = screen.getByRole("button", { name: /unlike this post\. 3 likes/i });
      expect(pressed).toHaveAttribute("aria-pressed", "true");
      expect(actions.setLike).toHaveBeenCalledWith("p1", true);

      resolve({ ok: true, liked: true, likeCount: 7 });
      expect(
        await screen.findByRole("button", { name: /unlike this post\. 7 likes/i }),
      ).toBeInTheDocument();
    });

    it("puts the old state back and says so when the server refuses", async () => {
      const user = userEvent.setup();
      actions.setLike.mockResolvedValue({ ok: false, error: "That post is no longer available." });
      render(<PostCard post={post()} onDeleted={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: /like this post/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
      expect(screen.getByRole("button", { name: /like this post\. 2 likes/i })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("can unlike a post the member already liked", async () => {
      const user = userEvent.setup();
      actions.setLike.mockResolvedValue({ ok: true, liked: false, likeCount: 1 });
      render(<PostCard post={post({ likedByMe: true })} onDeleted={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: /unlike this post/i }));
      expect(actions.setLike).toHaveBeenCalledWith("p1", false);
      expect(
        await screen.findByRole("button", { name: /like this post\. 1 like$/i }),
      ).toBeInTheDocument();
    });
  });

  describe("deleting", () => {
    it("asks first, then deletes and tells the list", async () => {
      const user = userEvent.setup();
      const onDeleted = vi.fn();
      actions.deletePost.mockResolvedValue({ ok: true });
      render(<PostCard post={post({ isOwn: true })} onDeleted={onDeleted} />);

      await user.click(screen.getByRole("button", { name: /delete your post/i }));
      expect(actions.deletePost).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: /yes, delete/i }));
      await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("p1"));
      expect(actions.deletePost).toHaveBeenCalledWith("p1");
    });

    it("can be cancelled, and reports a failure without removing the post", async () => {
      const user = userEvent.setup();
      const onDeleted = vi.fn();
      actions.deletePost.mockResolvedValue({ ok: false, error: "Not yours." });
      render(<PostCard post={post({ isOwn: true })} onDeleted={onDeleted} />);

      await user.click(screen.getByRole("button", { name: /delete your post/i }));
      await user.click(screen.getByRole("button", { name: /keep/i }));
      expect(screen.queryByRole("button", { name: /yes, delete/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /delete your post/i }));
      await user.click(screen.getByRole("button", { name: /yes, delete/i }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Not yours.");
      expect(onDeleted).not.toHaveBeenCalled();
    });
  });

  it("edits a post in place and shows the saved text", async () => {
    const user = userEvent.setup();
    actions.updatePost.mockResolvedValue({
      status: "success",
      saved: { category: "questions", body: "Updated wording", editedAt: "2026-10-29T10:00:00Z" },
    });
    render(<PostCard post={post({ isOwn: true })} onDeleted={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /edit your post/i }));
    const box = screen.getByRole("textbox", { name: /edit your post/i });
    expect(box).toHaveValue("Finished my first placement.");
    await user.clear(box);
    await user.type(box, "Updated wording");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: /edit your post/i })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Updated wording")).toBeInTheDocument();
    expect(screen.getByText(/Edited/)).toBeInTheDocument();
    expect(screen.getByText("Questions")).toBeInTheDocument();
    const [, formData] = actions.updatePost.mock.calls[0];
    expect(formData.get("id")).toBe("p1");
    expect(formData.get("body")).toBe("Updated wording");
  });

  describe("comments", () => {
    it("loads comments on demand, with delete only on the member's own", async () => {
      const user = userEvent.setup();
      actions.loadComments.mockResolvedValue({
        ok: true,
        comments: [comment(), comment({ id: "c2", body: "My note", isOwn: true })],
      });
      render(<PostCard post={post()} onDeleted={vi.fn()} />);
      expect(actions.loadComments).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /show comments\. 1 comment$/i }));
      expect(await screen.findByText("Congratulations!")).toBeInTheDocument();
      expect(actions.loadComments).toHaveBeenCalledWith("p1");
      expect(screen.getAllByRole("button", { name: /delete your comment/i })).toHaveLength(1);
      expect(screen.getByRole("button", { name: /hide comments/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    });

    it("adds a comment and updates the count from the server", async () => {
      const user = userEvent.setup();
      actions.loadComments.mockResolvedValue({ ok: true, comments: [] });
      actions.addComment.mockResolvedValue({
        ok: true,
        commentCount: 4,
        comment: comment({ id: "c9", body: "Thanks for sharing", isOwn: true }),
      });
      render(<PostCard post={post()} onDeleted={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: /show comments/i }));
      await screen.findByText(/no comments yet/i);

      await user.type(screen.getByRole("textbox", { name: /add a comment/i }), "Thanks for sharing");
      await user.click(screen.getByRole("button", { name: "Comment" }));

      expect(await screen.findByText("Thanks for sharing")).toBeInTheDocument();
      expect(actions.addComment).toHaveBeenCalledWith("p1", "Thanks for sharing");
      expect(screen.getByRole("button", { name: /hide comments\. 4 comments/i })).toBeInTheDocument();
    });

    it("won't send an empty comment", async () => {
      const user = userEvent.setup();
      actions.loadComments.mockResolvedValue({ ok: true, comments: [] });
      render(<PostCard post={post()} onDeleted={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: /show comments/i }));
      await screen.findByText(/no comments yet/i);
      await user.click(screen.getByRole("button", { name: "Comment" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(/write a comment/i);
      expect(actions.addComment).not.toHaveBeenCalled();
    });

    it("deletes the member's own comment and updates the count", async () => {
      const user = userEvent.setup();
      actions.loadComments.mockResolvedValue({
        ok: true,
        comments: [comment({ id: "c2", body: "My note", isOwn: true })],
      });
      actions.deleteComment.mockResolvedValue({ ok: true, commentCount: 0 });
      render(<PostCard post={post()} onDeleted={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: /show comments/i }));
      await user.click(await screen.findByRole("button", { name: /delete your comment/i }));
      await waitFor(() => expect(screen.queryByText("My note")).not.toBeInTheDocument());
      expect(actions.deleteComment).toHaveBeenCalledWith("c2", "p1");
      expect(screen.getByRole("button", { name: /hide comments\. 0 comments/i })).toBeInTheDocument();
    });

    it("offers a retry when comments fail to load", async () => {
      const user = userEvent.setup();
      actions.loadComments
        .mockResolvedValueOnce({ ok: false, error: "We couldn't load the comments." })
        .mockResolvedValueOnce({ ok: true, comments: [comment()] });
      render(<PostCard post={post()} onDeleted={vi.fn()} />);
      await user.click(screen.getByRole("button", { name: /show comments/i }));
      await user.click(await screen.findByRole("button", { name: /try again/i }));
      expect(await screen.findByText("Congratulations!")).toBeInTheDocument();
    });
  });
});

describe("FeedList pagination", () => {
  const empty = <p>Nothing here</p>;
  const posts = (ids: string[]) => ids.map((id) => post({ id, body: `Body ${id}` }));

  it("shows the first page and a Load more button while older posts exist", () => {
    render(
      <FeedList initial={{ posts: posts(["a", "b"]), nextCursor: "cur-1" }} empty={empty} />,
    );
    expect(within(screen.getByRole("list", { name: "Posts" })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /load more posts/i })).toBeInTheDocument();
  });

  it("requests the next page with the cursor, category and author, then appends", async () => {
    const user = userEvent.setup();
    actions.loadMorePosts.mockResolvedValue({
      ok: true,
      page: { posts: posts(["c", "d"]), nextCursor: null },
    });
    render(
      <FeedList
        initial={{ posts: posts(["a", "b"]), nextCursor: "cur-1" }}
        category="questions"
        authorId="u2"
        empty={empty}
      />,
    );
    await user.click(screen.getByRole("button", { name: /load more posts/i }));
    expect(await screen.findByText("Body d")).toBeInTheDocument();
    expect(actions.loadMorePosts).toHaveBeenCalledWith({
      cursor: "cur-1",
      category: "questions",
      authorId: "u2",
    });
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loaded 2 more posts.");
  });

  it("does not show the same post twice", async () => {
    const user = userEvent.setup();
    actions.loadMorePosts.mockResolvedValue({
      ok: true,
      page: { posts: posts(["b", "c"]), nextCursor: null },
    });
    render(<FeedList initial={{ posts: posts(["a", "b"]), nextCursor: "x" }} empty={empty} />);
    await user.click(screen.getByRole("button", { name: /load more/i }));
    await screen.findByText("Body c");
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("keeps what is loaded and offers a retry when loading more fails", async () => {
    const user = userEvent.setup();
    actions.loadMorePosts.mockResolvedValue({ ok: false, error: "We couldn't load more posts." });
    render(<FeedList initial={{ posts: posts(["a"]), nextCursor: "x" }} empty={empty} />);
    await user.click(screen.getByRole("button", { name: /load more/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't load more");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows the empty state when there are no posts at all", () => {
    render(<FeedList initial={{ posts: [], nextCursor: null }} empty={empty} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("drops a post from the list after its author deletes it", async () => {
    const user = userEvent.setup();
    actions.deletePost.mockResolvedValue({ ok: true });
    render(
      <FeedList
        initial={{
          posts: [post({ id: "mine", body: "Mine", isOwn: true }), post({ id: "x", body: "Other" })],
          nextCursor: null,
        }}
        empty={empty}
      />,
    );
    await user.click(screen.getByRole("button", { name: /delete your post/i }));
    await user.click(screen.getByRole("button", { name: /yes, delete/i }));
    await waitFor(() => expect(screen.queryByText("Mine")).not.toBeInTheDocument());
    expect(screen.getByText("Other")).toBeInTheDocument();
  });
});

describe("PostComposer", () => {
  it("lets the member pick any of the seven categories", () => {
    render(<PostComposer name="Amina" avatarSrc={null} />);
    const select = screen.getByRole("combobox", { name: "Category" });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "General Discussion",
      "Academic Life",
      "Career Journey",
      "Professional Advice",
      "Research and Knowledge",
      "Personal Achievement",
      "Questions",
    ]);
  });

  it("publishes the text and chosen category, then clears the box", async () => {
    const user = userEvent.setup();
    actions.createPost.mockResolvedValue({ status: "success", nonce: 1 });
    render(<PostComposer name="Amina" avatarSrc={null} />);

    const box = screen.getByRole("textbox", { name: /what would you like to share/i });
    await user.type(box, "My first post");
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "questions");
    await user.click(screen.getByRole("button", { name: /^post$/i }));

    await waitFor(() => expect(actions.createPost).toHaveBeenCalled());
    const [, formData] = actions.createPost.mock.calls[0];
    expect(formData.get("body")).toBe("My first post");
    expect(formData.get("category")).toBe("questions");
    await waitFor(() => expect(box).toHaveValue(""));
  });

  it("keeps the text and explains the problem when publishing fails", async () => {
    const user = userEvent.setup();
    actions.createPost.mockResolvedValue({
      status: "error",
      message: "You are posting too quickly. Please try again later.",
    });
    render(<PostComposer name="Amina" avatarSrc={null} />);
    const box = screen.getByRole("textbox", { name: /what would you like to share/i });
    await user.type(box, "Keep me");
    await user.click(screen.getByRole("button", { name: /^post$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/too quickly/);
    expect(box).toHaveValue("Keep me");
  });

  it("shows field errors from the server", async () => {
    const user = userEvent.setup();
    actions.createPost.mockResolvedValue({
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { body: ["Write something to share."] },
    });
    render(<PostComposer name="Amina" avatarSrc={null} />);
    await user.type(screen.getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: /^post$/i }));
    expect(await screen.findByText("Write something to share.")).toBeInTheDocument();
  });

  it("reminds members not to share patient information and links the guidelines", () => {
    render(<PostComposer name="Amina" avatarSrc={null} />);
    expect(screen.getByText(/never share identifiable patient information/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /community guidelines/i })).toHaveAttribute(
      "href",
      "/community-guidelines",
    );
  });
});

describe("FeedNav", () => {
  it("links to the latest feed and every category, marking the current one", () => {
    render(<FeedNav active="questions" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Latest" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Questions" })).toHaveAttribute(
      "href",
      "/?category=questions",
    );
    expect(screen.getByRole("link", { name: "Questions" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Latest" })).not.toHaveAttribute("aria-current");
  });

  it("marks Latest when no category is chosen", () => {
    render(<FeedNav />);
    expect(screen.getByRole("link", { name: "Latest" })).toHaveAttribute("aria-current", "page");
  });
});

describe("formatRelative", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  it.each([
    ["2026-10-30T11:59:40Z", "Just now"],
    ["2026-10-30T11:30:00Z", "30 min ago"],
    ["2026-10-30T11:00:00Z", "1 hour ago"],
    ["2026-10-30T07:00:00Z", "5 hours ago"],
    ["2026-10-28T12:00:00Z", "2 days ago"],
    ["2026-10-01T12:00:00Z", "Oct 1, 2026"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected);
  });
});
