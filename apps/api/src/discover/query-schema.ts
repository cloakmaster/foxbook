import { z } from "zod";

/**
 * Zod schema for `GET /api/v1/discover` query params. The happy-path response
 * is validated against `schemas/discover-response.v1.json` (generated types in
 * @foxbook/types-ts); this schema owns the INPUT contract. Keep the two in
 * lock-step when fields evolve.
 */
export const discoverQuerySchema = z.object({
  capability: z.string().min(1, "capability is required"),
  sub: z.string().min(1).optional(),
  tier: z.coerce.number().int().min(0).max(4).optional(),
  // Decimal monetary values stay as strings; we don't parse floats.
  budget_max_usd: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "budget_max_usd must be a decimal string")
    .optional(),
  latency_max_ms: z.coerce.number().int().min(0).optional(),
  payment_rail: z.enum(["x402", "ap2", "mpp"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
