import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  findActiveTarget: vi.fn(),
  findSetting: vi.fn(),
  transaction: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  apiErrorResponse: vi.fn((caught: unknown, message: string, status: number) =>
    Response.json(
      {
        error: caught instanceof Error ? caught.message : message,
      },
      { status },
    ),
  ),
  getCurrentAuthContext: vi.fn(),
  notifyWeightTicketLine: vi.fn(),
  readCredentialLock: vi.fn(),
  requirePermission: vi.fn(),
  sendLinePush: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    $transaction: db.transaction,
    line_targets: { findFirst: db.findActiveTarget },
    system_settings: { findUnique: db.findSetting },
  },
}));
vi.mock("@/lib/server/auth-context", () => ({
  AuthContextError: class AuthContextError extends Error {},
  authContextErrorResponse: vi.fn(),
  getCurrentAuthContext: mocks.getCurrentAuthContext,
  requirePermission: mocks.requirePermission,
}));
vi.mock("@/lib/server/api-error", () => ({
  apiErrorResponse: mocks.apiErrorResponse,
}));
vi.mock("@/lib/server/weight-ticket-line-notification", () => ({
  notifyWeightTicketLine: mocks.notifyWeightTicketLine,
  sendLinePush: mocks.sendLinePush,
}));
vi.mock("@/lib/server/daily", () => ({ currentActor: vi.fn() }));
vi.mock("@/lib/server/line-credential-lock", () => ({
  acquireLineCredentialReadLock: mocks.readCredentialLock,
}));

import { POST, resolveActiveTestTarget } from "./route";

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/admin/line-settings/test", {
    body: JSON.stringify({
      token: "••••••••••••••••",
      targetId: "C-LOCKED-TARGET",
      ...overrides,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

describe("LINE settings test target resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAuthContext.mockResolvedValue({
      appUser: { email: "tester@example.com" },
    });
    mocks.readCredentialLock.mockResolvedValue(undefined);
    mocks.notifyWeightTicketLine.mockResolvedValue({ status: 200 });
    db.findSetting.mockResolvedValue({ value: "locked-current-token" });
    db.findActiveTarget.mockResolvedValue({ target_id: "C-LOCKED-TARGET" });
    db.transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation !== "function") return [];
      return (
        operation as (transaction: {
          line_targets: { findFirst: typeof db.findActiveTarget };
          system_settings: { findUnique: typeof db.findSetting };
        }) => unknown
      )({
        line_targets: { findFirst: db.findActiveTarget },
        system_settings: { findUnique: db.findSetting },
      });
    });
    mocks.sendLinePush.mockResolvedValue({ lineRequestId: "req-1" });
  });

  it("does not fall back to a legacy group when no registered active target exists", async () => {
    db.findActiveTarget.mockResolvedValue(null);

    await expect(resolveActiveTestTarget()).resolves.toBeNull();
  });

  it("uses the selected registered active target", async () => {
    db.findActiveTarget.mockResolvedValue({ target_id: "C-NEW-OA-GROUP" });

    await expect(resolveActiveTestTarget("C-NEW-OA-GROUP")).resolves.toEqual({
      target_id: "C-NEW-OA-GROUP",
    });
    expect(db.findActiveTarget).toHaveBeenCalledWith({
      where: { target_id: "C-NEW-OA-GROUP", is_active: true },
      select: { target_id: true },
    });
  });

  it("waits for the shared credential lock before reading settings, target, or pushing", async () => {
    const events: string[] = [];
    let releaseLock!: () => void;
    const deferredLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    mocks.readCredentialLock.mockReturnValue(deferredLock);
    db.transaction.mockImplementationOnce(async (operation: unknown) => {
      events.push("transaction-start");
      const result = await (
        operation as (transaction: {
          line_targets: { findFirst: typeof db.findActiveTarget };
          system_settings: { findUnique: typeof db.findSetting };
        }) => unknown
      )({
        line_targets: { findFirst: db.findActiveTarget },
        system_settings: { findUnique: db.findSetting },
      });
      events.push("transaction-end");
      return result;
    });
    mocks.sendLinePush.mockImplementationOnce(async () => {
      events.push("push");
      return { lineRequestId: "req-locked" };
    });

    const responsePromise = POST(request());

    await vi.waitFor(() =>
      expect(mocks.readCredentialLock).toHaveBeenCalledOnce(),
    );
    expect(db.findSetting).not.toHaveBeenCalled();
    expect(db.findActiveTarget).not.toHaveBeenCalled();
    expect(mocks.sendLinePush).not.toHaveBeenCalled();

    releaseLock();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(db.findSetting).toHaveBeenCalledWith({
      where: { key: "LINE_CHANNEL_ACCESS_TOKEN" },
    });
    expect(db.findActiveTarget).toHaveBeenCalledWith({
      where: { target_id: "C-LOCKED-TARGET", is_active: true },
      select: { target_id: true },
    });
    expect(mocks.sendLinePush).toHaveBeenCalledWith(
      "C-LOCKED-TARGET",
      expect.any(Array),
      "locked-current-token",
    );
    expect(events).toEqual(["transaction-start", "push", "transaction-end"]);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("holds the shared credential lock through a document notification test", async () => {
    let releaseLock!: () => void;
    mocks.readCredentialLock.mockReturnValue(new Promise<void>((resolve) => {
      releaseLock = resolve;
    }));

    const responsePromise = POST(request({ documentNo: "WTI012606-0001" }));

    await vi.waitFor(() => expect(mocks.readCredentialLock).toHaveBeenCalledOnce());
    expect(db.findSetting).not.toHaveBeenCalled();
    expect(db.findActiveTarget).not.toHaveBeenCalled();
    expect(mocks.notifyWeightTicketLine).not.toHaveBeenCalled();

    releaseLock();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(mocks.sendLinePush).not.toHaveBeenCalled();
    expect(mocks.notifyWeightTicketLine).toHaveBeenCalledWith(
      "WTI012606-0001",
      expect.objectContaining({ force: true, targetId: "C-LOCKED-TARGET" }),
    );
  });
});
