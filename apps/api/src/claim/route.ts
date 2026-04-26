import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import {
  claimRevokeBodySchema,
  claimStartBodySchema,
  claimVerifyGistBodySchema,
} from "./body-schema.js";
import { type ClaimDeps, claimRevoke, claimStart, claimVerifyGist } from "./handlers.js";

/**
 * Mount POST /claim/start + POST /claim/verify-gist with injected deps.
 * Keeping deps outside this module is what lets tests drive the route
 * against a fake claim repo / fake gist / fake merkle appender —
 * same seam as /discover.
 */
export function claimRoute(deps: ClaimDeps): Hono {
  const app = new Hono();

  app.post("/claim/start", zValidator("json", claimStartBodySchema), async (c) => {
    const body = c.req.valid("json");
    const result = await claimStart(
      {
        assetType: body.asset_type,
        assetValue: body.asset_value,
        ed25519PublicKeyHex: body.ed25519_public_key_hex,
        recoveryKeyFingerprint: body.recovery_key_fingerprint,
        ...(body.agent_did !== undefined ? { agentDid: body.agent_did } : {}),
      },
      deps,
    );
    if (!result.ok) {
      return c.json({ status: result.status }, 409);
    }
    return c.json(
      {
        claim_id: result.claim.id,
        agent_did: result.claim.agentDid,
        verification_code: result.claim.verificationCode,
        state: result.claim.state,
        instructions:
          "Create a public GitHub Gist containing the verification_code above, then POST /api/v1/claim/verify-gist with the gist_url.",
      },
      201,
    );
  });

  app.post("/claim/verify-gist", zValidator("json", claimVerifyGistBodySchema), async (c) => {
    const body = c.req.valid("json");
    const result = await claimVerifyGist({ claimId: body.claim_id, gistUrl: body.gist_url }, deps);
    if (result.ok) {
      return c.json(
        {
          tier: result.tier,
          leaf_index: result.leafIndex,
          leaf_hash: result.leafHash,
          root_after: result.rootAfter,
          sth_jws: result.sthJws,
        },
        200,
      );
    }
    const statusCode =
      result.status === "not-found-claim"
        ? 404
        : result.status === "identity-mismatch"
          ? 409
          : result.status === "bad-request" || result.status === "wrong-asset-type"
            ? 400
            : 200; // still-pending / not-found (gist) / error all return 200
    // with a status field — caller polls on still-pending.
    return c.json(
      { status: result.status, reason: "reason" in result ? result.reason : undefined },
      statusCode,
    );
  });

  app.post("/claim/revoke", zValidator("json", claimRevokeBodySchema), async (c) => {
    const body = c.req.valid("json");
    const result = await claimRevoke(
      { claimId: body.claim_id, revocationRecordJws: body.revocation_record_jws },
      deps,
    );
    if (result.ok) {
      return c.json(
        {
          revoked: true,
          leaf_index: result.leafIndex,
          leaf_hash: result.leafHash,
          sth_jws: result.sthJws,
        },
        200,
      );
    }
    // Discriminated status → HTTP code mapping. Mirrors verify-gist's
    // pattern: 4xx = caller fault, 200 with status field = transient
    // (none here today; revoke has no still-pending equivalent).
    if (result.status === "not-found-claim") {
      return c.json({ status: result.status }, 404);
    }
    if (result.status === "bad-state") {
      return c.json({ status: result.status, current_state: result.currentState }, 400);
    }
    if (
      result.status === "recovery-key-mismatch" ||
      result.status === "recovery-key-signature-invalid"
    ) {
      return c.json(
        { status: result.status, reason: "reason" in result ? result.reason : undefined },
        403,
      );
    }
    // result.status === "invalid-leaf"
    return c.json({ status: result.status, reason: result.reason }, 422);
  });

  return app;
}
