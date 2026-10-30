import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  reauthenticate: vi.fn(),
  signOutOtherDevices: vi.fn(),
  signOutEverywhere: vi.fn(),
}));
vi.mock("@/features/security/actions", () => actions);

const { EmailCodeForm, ReauthForm } = await import("@/features/security/components/code-forms");
const { SessionsPanel } = await import("@/features/security/components/sessions-panel");

beforeEach(() => {
  vi.clearAllMocks();
  actions.sendEmailCode.mockResolvedValue({ ok: true, sentTo: "a•••n@example.com", minutes: 10 });
  actions.verifyEmailCode.mockResolvedValue({ status: "idle" });
  actions.signOutOtherDevices.mockResolvedValue({ ok: true });
});

describe("EmailCodeForm", () => {
  it("emails a code as soon as it opens, exactly once, and says where it went", async () => {
    render(<EmailCodeForm next="/network" />);
    expect(await screen.findByText(/we emailed a 6-digit code to a•••n@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/works for 10 minutes/i)).toBeInTheDocument();
    expect(actions.sendEmailCode).toHaveBeenCalledTimes(1);
  });

  it("collects a numeric one-time code and keeps the return address", async () => {
    render(<EmailCodeForm next="/network" />);
    const input = screen.getByLabelText(/6-digit code/i);
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("maxlength", "6");
    expect(document.querySelector("input[name=next]")).toHaveValue("/network");
    await screen.findByText(/we emailed/i);
  });

  it("shows why a code could not be sent, without exposing anything else", async () => {
    actions.sendEmailCode.mockResolvedValue({ ok: false, error: "We couldn't send the email right now. Please try again in a few minutes." });
    render(<EmailCodeForm />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't send the email/i);
    expect(screen.queryByText(/we emailed a 6-digit code/i)).not.toBeInTheDocument();
  });

  it("can send a new code and confirms it", async () => {
    const user = userEvent.setup();
    render(<EmailCodeForm />);
    await screen.findByText(/we emailed/i);
    await user.click(screen.getByRole("button", { name: /send a new code/i }));
    expect(actions.sendEmailCode).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/a new code is on its way/i)).toBeInTheDocument();
  });

  it("shows the cooldown message when a new code is asked for too soon", async () => {
    const user = userEvent.setup();
    render(<EmailCodeForm />);
    await screen.findByText(/we emailed/i);
    actions.sendEmailCode.mockResolvedValue({ ok: false, error: "A code was just sent. Please wait a minute before asking for another." });
    await user.click(screen.getByRole("button", { name: /send a new code/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a minute/i);
  });

  it("submits the entered code to the verification action", async () => {
    const user = userEvent.setup();
    render(<EmailCodeForm next="/network" />);
    await screen.findByText(/we emailed/i);
    await user.type(screen.getByLabelText(/6-digit code/i), "482910");
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(actions.verifyEmailCode).toHaveBeenCalled());
    const formData = actions.verifyEmailCode.mock.calls[0][1] as FormData;
    expect(formData.get("code")).toBe("482910");
    expect(formData.get("next")).toBe("/network");
  });

  it("shows a wrong-code error from the server", async () => {
    const user = userEvent.setup();
    actions.verifyEmailCode.mockResolvedValue({ status: "error", message: "That code didn't work. Check the newest email and try again." });
    render(<EmailCodeForm />);
    await screen.findByText(/we emailed/i);
    await user.type(screen.getByLabelText(/6-digit code/i), "000000");
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(await screen.findByText(/didn't work/i)).toBeInTheDocument();
  });
});

describe("ReauthForm", () => {
  it("asks for the password with the right autocomplete token and keeps the return address", () => {
    render(<ReauthForm next="/settings/security" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
    expect(document.querySelector("input[name=next]")).toHaveValue("/settings/security");
  });
});

describe("SessionsPanel", () => {
  it("signs out other devices and says so", async () => {
    const user = userEvent.setup();
    render(<SessionsPanel />);
    await user.click(screen.getByRole("button", { name: /sign out other devices/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/every other device was signed out/i);
  });

  it("is honest that individual devices are not listed", () => {
    render(<SessionsPanel />);
    expect(screen.getByText(/list of devices isn't available/i)).toBeInTheDocument();
  });

  it("can sign out everywhere", async () => {
    const user = userEvent.setup();
    render(<SessionsPanel />);
    await user.click(screen.getByRole("button", { name: /sign out everywhere/i }));
    expect(actions.signOutEverywhere).toHaveBeenCalled();
  });
});
