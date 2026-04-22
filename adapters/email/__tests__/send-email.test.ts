import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the `resend` SDK at the module boundary. The constructor must be
// callable with `new`, so we expose a real class whose instance exposes
// the captured `sendMock`.
const sendMock = vi.fn();
vi.mock("resend", () => {
  class Resend {
    emails: { send: typeof sendMock };
    constructor() {
      this.emails = { send: sendMock };
    }
  }
  return { Resend };
});

// Import AFTER vi.mock so the module picks up the stubbed `resend`.
// Uses a dynamic import to respect the vi.mock hoist.
async function importAdapter() {
  const mod = await import("../src/index.js");
  return mod;
}

describe("sendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    sendMock.mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  });

  it("forwards the payload to resend.emails.send and returns the id", async () => {
    process.env.RESEND_API_KEY = "re_testkey_1234567890";
    sendMock.mockResolvedValueOnce({ data: { id: "msg_abc123" }, error: null });

    const { sendEmail } = await importAdapter();
    const res = await sendEmail({
      from: "hello@foxbook.dev",
      to: "ben@example.com",
      subject: "test",
      text: "plain body",
      replyTo: "noreply@foxbook.dev",
    });

    expect(res).toEqual({ id: "msg_abc123" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      from: "hello@foxbook.dev",
      to: "ben@example.com",
      subject: "test",
      text: "plain body",
      replyTo: "noreply@foxbook.dev",
    });
  });

  it("sends with html only (no text body required)", async () => {
    process.env.RESEND_API_KEY = "re_testkey_1234567890";
    sendMock.mockResolvedValueOnce({ data: { id: "msg_html" }, error: null });

    const { sendEmail } = await importAdapter();
    await sendEmail({
      from: "a@foxbook.dev",
      to: ["x@example.com", "y@example.com"],
      subject: "h",
      html: "<p>hi</p>",
    });

    expect(sendMock).toHaveBeenCalledWith({
      from: "a@foxbook.dev",
      to: ["x@example.com", "y@example.com"],
      subject: "h",
      html: "<p>hi</p>",
    });
  });

  it("throws when neither html nor text is provided", async () => {
    process.env.RESEND_API_KEY = "re_testkey_1234567890";
    const { sendEmail } = await importAdapter();
    await expect(
      sendEmail({ from: "a@foxbook.dev", to: "x@example.com", subject: "s" }),
    ).rejects.toThrow(/requires at least one of `html` or `text`/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws a non-leaky error when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await importAdapter();

    try {
      await sendEmail({
        from: "a@foxbook.dev",
        to: "x@example.com",
        subject: "s",
        text: "t",
      });
      expect.fail("sendEmail should have thrown");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toBe("RESEND_API_KEY is not set in the environment.");
      // Non-leak contract: the error MUST NOT hint at key shape/prefix/length.
      expect(msg).not.toMatch(/re_/);
      expect(msg).not.toMatch(/prefix|length|shape/i);
    }
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("surfaces a neutral error when resend returns { error }", async () => {
    process.env.RESEND_API_KEY = "re_testkey_1234567890";
    sendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "invalid_from_address", message: "domain not verified" },
    });

    const { sendEmail } = await importAdapter();
    try {
      await sendEmail({
        from: "not-verified@foxbook.dev",
        to: "x@example.com",
        subject: "s",
        text: "t",
      });
      expect.fail("sendEmail should have thrown");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toBe("resend error: invalid_from_address: domain not verified");
      // Re-assert no secret material leaked into the error.
      expect(msg).not.toMatch(/re_testkey/);
    }
  });

  it("throws when resend response is missing id", async () => {
    process.env.RESEND_API_KEY = "re_testkey_1234567890";
    sendMock.mockResolvedValueOnce({ data: {}, error: null });

    const { sendEmail } = await importAdapter();
    await expect(
      sendEmail({ from: "a@foxbook.dev", to: "x@example.com", subject: "s", text: "t" }),
    ).rejects.toThrow(/no id/);
  });
});
