import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: (e: unknown) => captureException(e) }));

const { default: ErrorPage } = await import("@/app/error");

describe("page error screen", () => {
  it("explains the problem kindly, hides the technical message, and reports it", () => {
    const error = Object.assign(new Error("secret db detail: relation posts"), {
      digest: "abc123",
    });
    render(<ErrorPage error={error} reset={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /couldn.t load this page/i })).toBeInTheDocument();
    expect(screen.queryByText(/secret db detail/)).not.toBeInTheDocument();
    expect(screen.getByText(/Reference: abc123/)).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("offers a retry and a way home", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("x")} reset={reset} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /go to home/i })).toHaveAttribute("href", "/");
  });
});
