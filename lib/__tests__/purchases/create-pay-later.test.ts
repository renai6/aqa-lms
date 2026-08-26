process.env.SUPABASE_STORAGE_BUCKET = "test-bucket";

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    purchase: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { storage: { from: vi.fn() } },
}));
vi.mock("@/lib/uploads/image", () => ({ validateImageUpload: vi.fn() }));
vi.mock("@/lib/purchases/queries", () => ({ getPurchasableCourses: vi.fn() }));
vi.mock("@/lib/purchases/email", () => ({
  sendPurchaseConfirmationEmail: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateImageUpload } from "@/lib/uploads/image";
import { getPurchasableCourses } from "@/lib/purchases/queries";
import { sendPurchaseConfirmationEmail } from "@/lib/purchases/email";
import { createPurchaseAction } from "@/lib/purchases/actions";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("createPurchaseAction pay later", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      userId: "u1",
      role: "STUDENT",
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValue({
      email: "s@example.com",
      firstName: "Sam",
      studentType: "OLD",
      isActive: true,
    } as never);
    vi.mocked(getPurchasableCourses).mockResolvedValue([{ id: "c1" }] as never);
    vi.mocked(db.purchase.create).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(db.purchase.delete).mockResolvedValue({ id: "p1" } as never);
  });

  it("records a zero amount and no proof, and never touches storage", async () => {
    await expect(
      createPurchaseAction(
        { error: null },
        form({ courseIds: "c1", paymentType: "PARTIAL", payLater: "on" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountPaid: 0,
          paymentProofUrl: null,
        }),
      }),
    );
    expect(validateImageUpload).not.toHaveBeenCalled();
    expect(supabaseAdmin.storage.from).not.toHaveBeenCalled();
    expect(db.purchase.update).not.toHaveBeenCalled();
  });

  it("tells the confirmation email that no payment is due yet", async () => {
    await expect(
      createPurchaseAction(
        { error: null },
        form({ courseIds: "c1", paymentType: "PARTIAL", payLater: "on" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(sendPurchaseConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ payLater: true }),
    );
  });

  it("still requires a proof image when paying now", async () => {
    vi.mocked(validateImageUpload).mockResolvedValue({
      ok: false,
      error: "Please select a file to upload.",
    });

    const result = await createPurchaseAction(
      { error: null },
      form({ courseIds: "c1", paymentType: "PARTIAL", amountPaid: "5000" }),
    );

    expect(result.error).toBe("Please select a file to upload.");
    expect(db.purchase.create).not.toHaveBeenCalled();
  });

  it("deletes the purchase when the proof url cannot be saved", async () => {
    vi.mocked(validateImageUpload).mockResolvedValue({
      ok: true,
      buffer: Buffer.from("x"),
      ext: "jpg",
      contentType: "image/jpeg",
    });
    const upload = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.storage.from).mockReturnValue({ upload } as never);
    vi.mocked(db.purchase.update).mockRejectedValue(new Error("db down"));

    const result = await createPurchaseAction(
      { error: null },
      form({ courseIds: "c1", paymentType: "PARTIAL", amountPaid: "5000" }),
    );

    expect(result.error).toContain("could not be saved");
    expect(db.purchase.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});
