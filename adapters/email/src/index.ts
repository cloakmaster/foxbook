// Resend transactional-email adapter. Thin pass-through, no retries, no queue.
// Retries belong in the caller. Adapter-only module: MUST NOT be imported by
// core/** or packages/** (see core-isolation.config.json).

import { Resend } from "resend";

/** Input to sendEmail. Strict types — every field must be a string of the expected shape. */
export type SendEmailInput = {
  /** RFC 5321 from address. Must be on a Resend-verified domain. */
  from: string;
  /** Single recipient (v0) or a list — Resend accepts both. */
  to: string | string[];
  subject: string;
  /** HTML body. Either `html` or `text` (or both) must be provided. */
  html?: string;
  /** Plain-text body (useful as the text/plain MIME alternative). */
  text?: string;
  /** Optional reply-to address. */
  replyTo?: string;
};

export type SendEmailResult = {
  /** Resend message id — persist this if you need delivery proofs. */
  id: string;
};

/**
 * Send one transactional email via Resend. Reads `RESEND_API_KEY` from
 * `process.env` at call time (never at module load — lets tests import
 * this module without the env set). Never logs the key. Never includes
 * it in thrown error messages.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!input.html && !input.text) {
    throw new Error("sendEmail requires at least one of `html` or `text`.");
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Intentionally vague — do not mention prefix, length, or shape hints.
    throw new Error("RESEND_API_KEY is not set in the environment.");
  }

  const client = new Resend(apiKey);
  const payload: {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  } = {
    from: input.from,
    to: input.to,
    subject: input.subject,
  };
  if (input.html !== undefined) payload.html = input.html;
  if (input.text !== undefined) payload.text = input.text;
  if (input.replyTo !== undefined) payload.replyTo = input.replyTo;

  const { data, error } = await client.emails.send(
    payload as Parameters<typeof client.emails.send>[0],
  );

  if (error) {
    // Resend error shape: { name, message }. Never surfaces the API key.
    throw new Error(`resend error: ${error.name}: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("resend returned no id — unexpected response shape.");
  }
  return { id: data.id };
}
