import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { api } from "../api.js";
import { LaundryPage } from "../pages/LaundryPage.jsx";

vi.mock("../api.js", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const available = [
  { _id: "shirt-1", name: "Blue shirt", category: "Tops" },
  { _id: "towel-1", name: "Bath towel", category: "Bedding" },
];

function overview(overrides = {}) {
  return {
    canSubmit: true,
    currentDay: "Monday",
    laundryDays: ["Monday"],
    availableItems: available,
    history: [],
    ...overrides,
  };
}

function renderPage() {
  return render(<MemoryRouter><LaundryPage /></MemoryRouter>);
}

describe("laundry workflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends only selected clothes and refreshes the closet overview", async () => {
    const user = userEvent.setup();
    api.get.mockResolvedValue(overview());
    api.post.mockResolvedValue({});
    renderPage();

    await user.click(await screen.findByRole("checkbox", { name: /Blue shirt/ }));
    await user.click(screen.getByRole("button", { name: /Send 1 piece to laundry/ }));

    expect(api.post).toHaveBeenCalledWith("/laundry", { itemIds: ["shirt-1"] });
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("checkbox", { name: /Blue shirt/ }).checked).toBe(false);
  });

  it("marks a pending item returned and reloads its history", async () => {
    const user = userEvent.setup();
    api.get
      .mockResolvedValueOnce(overview({ history: [{ _id: "event-1", item: available[0], status: "pending", sentAt: "2026-11-15T10:00:00Z" }] }))
      .mockResolvedValueOnce(overview({ history: [{ _id: "event-1", item: available[0], status: "returned", sentAt: "2026-11-15T10:00:00Z", returnedAt: "2026-11-15T12:00:00Z" }] }));
    api.post.mockResolvedValue({});
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Mark returned" }));

    expect(api.post).toHaveBeenCalledWith("/laundry/event-1/return", {});
    expect(await screen.findByText("returned")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Mark returned" })).toBeNull();
  });

  it("prevents starting a cycle outside the resident's schedule", async () => {
    api.get.mockResolvedValue(overview({ canSubmit: false, currentDay: "Tuesday" }));
    renderPage();

    expect(await screen.findByText(/Your schedule is set for other days/)).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: /Blue shirt/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Send selected pieces to laundry/ }).disabled).toBe(true);
  });
});
