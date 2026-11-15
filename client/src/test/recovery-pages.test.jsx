import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api } from "../api.js";
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "../pages/RecoveryPages.jsx";

vi.mock("../api.js", () => ({ api: { post: vi.fn() } }));

function renderPage(page) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

describe("account recovery screens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests a password reset and displays the generic confirmation", async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValue({ message: "If a verified Washday account uses that email, a password reset link will be sent." });
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "resident@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(api.post).toHaveBeenCalledWith("/auth/password-reset/request", { email: "resident@example.test" });
    expect((await screen.findByRole("status")).textContent).toContain("If a verified Washday account uses that email");
  });

  it("shows a delivery error and re-enables the request button", async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce(new Error("Email delivery is unavailable."));
    renderPage(<ForgotPasswordPage />);

    await user.type(screen.getByRole("textbox", { name: "Email" }), "resident@example.test");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Email delivery is unavailable.");
    expect(screen.getByRole("button", { name: "Send reset link" }).disabled).toBe(false);
  });

  it("removes the verification token from the URL before redeeming it", async () => {
    window.history.replaceState(null, "", "/verify-email#verification-token");
    api.post.mockResolvedValue({ message: "Email verified. Password recovery is now available." });
    renderPage(<VerifyEmailPage />);

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/email/verification/confirm", { token: "verification-token" }));
    expect(window.location.hash).toBe("");
    expect((await screen.findByRole("status")).textContent).toContain("Email verified.");
  });

  it("submits a reset token and both password fields, then removes the form", async () => {
    window.history.replaceState(null, "", "/reset-password#reset-token");
    api.post.mockResolvedValue({ message: "Password changed. Sign in again on your devices." });
    const user = userEvent.setup();
    renderPage(<ResetPasswordPage />);

    const password = await screen.findByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    await user.type(password, "a new long password");
    await user.type(confirmation, "a new long password");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    expect(api.post).toHaveBeenCalledWith("/auth/password-reset/complete", {
      token: "reset-token",
      newPassword: "a new long password",
      confirmPassword: "a new long password",
    });
    expect((await screen.findByRole("status")).textContent).toContain("Password changed.");
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("never submits the password reset form when the URL has no token", () => {
    window.history.replaceState(null, "", "/reset-password");
    renderPage(<ResetPasswordPage />);

    expect(screen.getByRole("alert").textContent).toContain("This reset link is missing its token.");
    expect(screen.queryByRole("button", { name: "Update password" })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });
});
