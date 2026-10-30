import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  startTotpEnrollment: vi.fn(),
  verifyTotpEnrollment: vi.fn(),
  createRecoveryCodes: vi.fn(),
  removeFactor: vi.fn(),
  verifyMfaChallenge: vi.fn(),
  redeemRecoveryCode: vi.fn(),
  reauthenticate: vi.fn(),
  signOutOtherDevices: vi.fn(),
  signOutEverywhere: vi.fn(),
}));
vi.mock("@/features/security/actions", () => actions);
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { AuthenticatorPanel } = await import("@/features/security/components/authenticator-panel");
const { MfaVerifyForm, RecoveryForm, ReauthForm } = await import("@/features/security/components/code-forms");
const { SessionsPanel } = await import("@/features/security/components/sessions-panel");

const factor = { id: "f1", name: "Authenticator app", createdAt: "2026-11-01" };

beforeEach(() => {
  vi.clearAllMocks();
  actions.startTotpEnrollment.mockResolvedValue({ ok: true, factorId: "f9", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP" });
  actions.verifyTotpEnrollment.mockResolvedValue({ ok: true });
  actions.createRecoveryCodes.mockResolvedValue({ ok: true, codes: ["aaaa-bbbb-cccc", "dddd-eeee-ffff"] });
  actions.removeFactor.mockResolvedValue({ ok: true });
  actions.signOutOtherDevices.mockResolvedValue({ ok: true });
});

describe("AuthenticatorPanel", () => {
  it("explains why MFA is needed when it is required and nothing is set up", () => {
    render(<AuthenticatorPanel factors={[]} recoveryRemaining={null} required />);
    expect(screen.getByText(/required to use Medyra/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set up authenticator app/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /recovery codes/i })).not.toBeInTheDocument();
  });

  it("walks through setup: key and QR code, confirm a code, then show recovery codes once", async () => {
    const user = userEvent.setup();
    render(<AuthenticatorPanel factors={[]} recoveryRemaining={null} required />);
    await user.click(screen.getByRole("button", { name: /set up authenticator app/i }));

    expect(await screen.findByAltText(/QR code/i)).toBeInTheDocument();
    expect(screen.getByTestId("setup-secret")).toHaveTextContent("JBSWY3DPEHPK3PXP");

    await user.type(screen.getByLabelText(/6-digit code/i), "123456");
    await user.click(screen.getByRole("button", { name: /turn on/i }));
    expect(actions.verifyTotpEnrollment).toHaveBeenCalledWith("f9", "123456");

    const list = await screen.findByRole("list", { name: /recovery codes/i });
    expect(list).toHaveTextContent("aaaa-bbbb-cccc");
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /i saved them/i }));
    expect(screen.queryByRole("list", { name: /recovery codes/i })).not.toBeInTheDocument();
  });

  it("shows a wrong code as an error and keeps the setup open", async () => {
    const user = userEvent.setup();
    actions.verifyTotpEnrollment.mockResolvedValue({ ok: false, error: "That code didn't work. Check the clock on your phone and try again." });
    render(<AuthenticatorPanel factors={[]} recoveryRemaining={null} required={false} />);
    await user.click(screen.getByRole("button", { name: /set up authenticator app/i }));
    await user.type(await screen.findByLabelText(/6-digit code/i), "000000");
    await user.click(screen.getByRole("button", { name: /turn on/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't work/);
    expect(screen.getByAltText(/QR code/i)).toBeInTheDocument();
    expect(actions.createRecoveryCodes).not.toHaveBeenCalled();
  });

  it("can cancel a setup", async () => {
    const user = userEvent.setup();
    render(<AuthenticatorPanel factors={[]} recoveryRemaining={null} required={false} />);
    await user.click(screen.getByRole("button", { name: /set up authenticator app/i }));
    await user.click(await screen.findByRole("button", { name: /cancel/i }));
    expect(screen.queryByAltText(/QR code/i)).not.toBeInTheDocument();
  });

  it("lists enrolled authenticators and removes one", async () => {
    const user = userEvent.setup();
    render(<AuthenticatorPanel factors={[factor]} recoveryRemaining={4} required />);
    expect(screen.getByText(/4 unused codes left/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Authenticator app" }));
    expect(actions.removeFactor).toHaveBeenCalledWith("f1");
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("sends the member to confirm their password when a sensitive action needs it", async () => {
    const user = userEvent.setup();
    actions.removeFactor.mockResolvedValue({ ok: false, error: "x", reauth: true });
    actions.createRecoveryCodes.mockResolvedValue({ ok: false, error: "x", reauth: true });
    render(<AuthenticatorPanel factors={[factor]} recoveryRemaining={null} required={false} />);
    await user.click(screen.getByRole("button", { name: "Remove Authenticator app" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/reauth?next=%2Fsettings%2Fsecurity"));
    await user.click(screen.getByRole("button", { name: /create recovery codes/i }));
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
  });

  it("shows the server's message when the last authenticator cannot be removed", async () => {
    const user = userEvent.setup();
    actions.removeFactor.mockResolvedValue({ ok: false, error: "MFA is required on Medyra. Add a second authenticator before removing this one." });
    render(<AuthenticatorPanel factors={[factor]} recoveryRemaining={3} required />);
    await user.click(screen.getByRole("button", { name: "Remove Authenticator app" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/MFA is required/);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("replaces recovery codes and shows the new ones", async () => {
    const user = userEvent.setup();
    render(<AuthenticatorPanel factors={[factor]} recoveryRemaining={1} required />);
    expect(screen.getByText(/1 unused code left/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /replace recovery codes/i }));
    expect(await screen.findByRole("list", { name: /recovery codes/i })).toHaveTextContent("dddd-eeee-ffff");
  });
});

describe("code forms", () => {
  it("collects the 6-digit code with the right input hints and no autofill of other fields", () => {
    render(<MfaVerifyForm next="/network" />);
    const input = screen.getByLabelText(/6-digit code/i);
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("maxlength", "6");
    expect(document.querySelector("input[name=next]")).toHaveValue("/network");
  });

  it("offers a recovery form that does not spell-check or capitalise the code", () => {
    render(<RecoveryForm />);
    const input = screen.getByLabelText(/recovery code/i);
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(screen.getByRole("button", { name: /use recovery code/i })).toBeInTheDocument();
  });

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
