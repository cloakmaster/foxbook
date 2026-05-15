# USPTO Trademark Filing Runbook — "Foxbook"

**Audience**: Benjamin (or whoever holds the Foxbook trademark interest), executing the USPTO filing.
**Estimated time**: 60-90 minutes once you're at uspto.gov and ready to file.
**Estimated cost**: $350 (TEAS Standard, 1 class) to $700 (TEAS Standard, 2 classes) — see §4.
**Status**: ready to file when Benjamin chooses. No external deadline; longstanding ops to-do flagged in [`TRADEMARK.md`](../../TRADEMARK.md).

---

## Why this filing matters

The Foxbook trademark currently exists as a **common-law mark** — Benjamin has been using "Foxbook" in commerce since the npm publish of `@foxbook/sdk-claim` (2026-04-29) and the foxbook.dev landing deployment. Common-law marks are enforceable, but only:

- In geographic regions where actual use is documented (limited)
- With limited remedies (no statutory damages, harder injunctions)
- Without the legal presumption of validity that comes with USPTO registration

A USPTO-registered trademark provides:

- **Nationwide priority** (effective from the filing date, applies across the entire US regardless of geographic use pattern)
- **Statutory damages** for infringement (up to $200,000 per willful counterfeit per type of goods)
- **Customs enforcement** against imported infringing goods
- **The ® symbol** as a defensible mark indicator
- **Presumption of ownership** in litigation
- **Strong defense** against later applicants of similar marks (USPTO refuses confusingly-similar marks at examination)

The recent industry-report citations (State of Agent Security — Q2 2026, §3.8 + §4 + byline) raise the cost of *not* having a registered mark. As the substrate position compounds (more citations, more integrators, eventually more revenue or stakeholder value), the brand-protection gap becomes proportionally more expensive to close. **Filing now is operationally cheaper than filing later.**

---

## Pre-filing checklist

- [ ] Decide on the mark itself: **"Foxbook"** (standard character mark — no logo, no stylization)
- [ ] Decide on filing classes: **Class 9** (downloadable software) + **Class 42** (SaaS / online services) recommended — see §3
- [ ] Have a `.jpg` or `.pdf` specimen of use ready for each class — see §5
- [ ] Know the first-use-in-commerce date: **2026-04-29** (npm publish of `@foxbook/sdk-claim`, first commerce use)
- [ ] Have payment ready (credit card or USPTO deposit account): $350-$700 depending on filing system + classes
- [ ] Have a registered USPTO account (uspto.gov) — create if needed (~5 min)
- [ ] Be prepared to act as your own correspondent OR pre-arrange a trademark attorney (latter is optional; $200-1500 additional)

---

## Step 1 — Sign in to USPTO TEAS

Go to https://www.uspto.gov/trademarks/apply

Choose the filing system:

- **TEAS Plus** ($250/class): cheaper but requires you to pick goods/services from USPTO's pre-approved Trademark ID Manual exactly. More restrictive but no risk of fee forfeiture.
- **TEAS Standard** ($350/class): allows custom goods/services descriptions. Recommended for novel categories ("transparency log infrastructure" is not in the TID Manual under that exact wording).

**Recommendation for Foxbook: TEAS Standard, 2 classes = $700 total.** The flexibility on goods/services description matters for a substrate primitive that doesn't fit standard ID Manual categories cleanly.

---

## Step 2 — Owner / Applicant information

- **Mark Owner**: Benjamin Bandali (individual person)
- **Address**: Benjamin's primary mailing address
- **Citizenship**: as applicable
- **Email**: hello@foxbook.dev (or Benjamin's primary)
- **Filing Basis**: 1(a) — Use in Commerce (the mark is already in use; see §6 for first-use evidence)

If filing as an individual, the form is straightforward. If you later transfer to a Foxbook LLC or other entity, that's a separate assignment filing — simpler and cheaper to file as an individual now.

---

## Step 3 — Goods and Services (Classes)

USPTO requires marks to be associated with specific goods/services classes. Foxbook's use spans two natural classes:

### Class 9 — Downloadable Software

**Suggested description**:

> "Downloadable computer software for verifying agent identity through public transparency-log inclusion proofs; downloadable computer software for cryptographic agent identity verification anchored by Merkle transparency logs; downloadable software development kits (SDKs) for integrating verifiable agent identity in autonomous agent applications."

The npm-published `@foxbook/sdk-claim` (TypeScript) is the qualifying use in this class. Specimen: screenshot of npmjs.com/package/@foxbook/sdk-claim showing the published package + the Foxbook mark in package metadata.

### Class 42 — SaaS / Online Services

**Suggested description**:

> "Software as a service (SAAS) featuring software for verifying agent identity through public transparency-log inclusion proofs; providing online non-downloadable software for cryptographic agent identity verification anchored by Merkle transparency logs; computer services, namely, providing an online platform for publishing and resolving decentralized identifiers (DIDs) for autonomous agents."

The operational deployment at `transparency.foxbook.dev` + `api.foxbook.dev` is the qualifying use in this class. Specimen: screenshot of foxbook.dev landing page showing the Foxbook mark + a screenshot of a live API response (e.g., from `https://transparency.foxbook.dev/root`).

### Note on class selection

USPTO accepts multi-class filings. Filing both classes ($700) provides broader protection. If budget is a constraint, **Class 9 alone is the minimum-viable filing** ($350) — it covers the npm SDK, which is the most-commerce-active surface. Class 42 can be added later via a separate filing (no savings) or via amendment (with restrictions).

**Recommendation**: file both classes.

---

## Step 4 — Cost breakdown

| Filing System | 1 Class | 2 Classes | Recommended? |
|---|---|---|---|
| TEAS Plus | $250 | $500 | Only if your services fit pre-approved descriptions exactly |
| TEAS Standard | $350 | $700 | **Recommended** for Foxbook's novel category |

Both filing systems require **renewal fees** between years 5-6 (Section 8 declaration of continued use, ~$425) and every 10 years thereafter (Sections 8 + 9, ~$750). Budget ~$100/year amortized over the life of the registration.

If a USPTO examining attorney issues an office action (request for clarification), responses are free if filed via TEAS but require time. Office actions are common — budget 1-2 hours for response work over the 8-12 month examination period.

---

## Step 5 — Specimen of Use

A specimen must show the mark *as actually used in commerce* — not a logo design, not the website's marketing prose, but the mark appearing on or in connection with the goods/services as they're offered.

### Class 9 specimen options (pick one)

- Screenshot of `https://www.npmjs.com/package/@foxbook/sdk-claim` showing the package page with "@foxbook/sdk-claim" prominently visible. This shows the Foxbook mark in commerce as part of the downloadable software identifier.
- Screenshot of the SDK's README.md showing the Foxbook mark in usage context (e.g., `import { verifyAgentCard } from "@foxbook/sdk-claim"`).

### Class 42 specimen options (pick one)

- Screenshot of `https://foxbook.dev/` showing the Foxbook landing with the mark visible in the heading.
- Screenshot of a live API response from `https://transparency.foxbook.dev/root` showing the response headers / body with operational evidence (capture the URL bar so the mark association is unambiguous).
- Screenshot of `https://api.foxbook.dev/healthz` returning 200 — combined with the foxbook.dev landing this clearly shows SaaS in operation.

Save specimens as `.jpg` or `.pdf` (USPTO accepts both). Filename suggestion: `foxbook-class-09-specimen.png` and `foxbook-class-42-specimen.png` for clarity.

### Dates of first use

- **First use in commerce (anywhere)**: 2026-04-29 (npm publish of `@foxbook/sdk-claim@0.1.0` per the package metadata)
- **First use in interstate commerce**: 2026-04-29 (npm is inherently interstate)

If you've used the mark earlier (e.g., on Discussion posts or in a pre-launch blog post), USPTO accepts the earliest verifiable date.

---

## Step 6 — Submit and pay

Once all fields are complete and specimens are uploaded:

1. Review the application summary carefully — especially the goods/services descriptions and specimens.
2. Pay the fees ($350-$700 depending on classes).
3. Submit. You'll receive a USPTO confirmation with a serial number.

Save the serial number — it's how you'll track the application through examination.

---

## Step 7 — Post-filing tracking

After submission:

1. **Initial confirmation**: ~1 business day. Serial number assigned.
2. **Examination assignment**: ~3-4 months. A USPTO examining attorney is assigned to your application.
3. **Office action (possible)**: ~3-6 months from filing. If issued, you have 6 months to respond (or 3 months with a 3-month extension request).
4. **Publication for Opposition**: if no issues, your mark is published in the USPTO's Official Gazette for a 30-day public-opposition period.
5. **Registration**: ~8-12 months from filing in the no-opposition path.

Check status periodically at https://tsdr.uspto.gov/ with your serial number.

### Common office action causes

- **Identification of goods/services too broad**: examining attorney requests narrower wording. Respond by adopting the requested language or proposing a clarification.
- **Specimen unacceptable**: examining attorney determines the specimen doesn't clearly show use in commerce. Respond by submitting a better specimen or supplementing with declarations.
- **Likelihood of confusion**: examining attorney finds a similar mark in their search. Respond by arguing distinctiveness (different goods, different channel, sophistication of consumers).

For Foxbook, likelihood-of-confusion risks are low: the mark is distinctive (combination of "Fox" + "book" in the agent-identity-infrastructure space is unique as of 2026-05). Verify against the USPTO database (TESS, https://tmsearch.uspto.gov/) before filing — search for "Foxbook", "Fox Book", "Foxbooks", "FoxBOOK" to confirm no priority conflicts.

---

## Step 8 — After registration

Once the mark is registered:

1. Use the ® symbol on the mark (legally OK after registration; before registration use ™).
2. Update [`TRADEMARK.md`](../../TRADEMARK.md) with the registration number and date.
3. Set a calendar reminder for the Section 8 declaration of continued use (between years 5 and 6 from registration).
4. Add a memory entry capturing the registration date + serial number.

---

## Optional: Trademark attorney engagement

A trademark attorney typically charges $200-$1500 to file a US trademark application on your behalf. Considerations:

- **DIY is reasonable** if the mark is straightforward and goods/services fit standard categories.
- **Attorney recommended** if you're filing internationally, defending against an opposition, or the goods/services are novel enough that USPTO examination is likely to be contentious.

For Foxbook, DIY is reasonable. The mark is distinctive, the use is clearly documented, the goods/services span familiar classes (9 + 42). If an office action arrives that requires legal argumentation (e.g., likelihood-of-confusion analysis), engaging an attorney *at that point* is a defensible choice.

Optional referral: USPTO maintains a list of trademark attorneys at https://www.uspto.gov/trademarks/getting-started/legal-help. The major trademark search/filing services (LegalZoom, Trademark Engine, etc.) are not recommended — they file the application themselves but charge for boilerplate work you can do equally well at USPTO directly.

---

## Failure modes

**Application abandoned because office action not responded to**: standard mistake. Set a calendar reminder for any USPTO correspondence — the 6-month response window is firm.

**Mark rejected (final office action affirmed)**: rare for distinctive marks. If it happens, options are: (a) appeal to the Trademark Trial and Appeal Board (TTAB; ~$200 + attorney fees), (b) narrow the goods/services and refile, (c) accept the rejection and continue under common-law mark.

**Mark registered but later challenged**: post-registration, third parties have 5 years to petition for cancellation. After 5 years, the mark becomes "incontestable" with limited grounds for cancellation. Year 5-6 Section 8 declaration is the trigger for incontestability registration (additional $200, optional but recommended).

---

## Beyond the US

If Foxbook expands to international use, the Madrid Protocol (https://www.uspto.gov/trademarks/laws/madrid-protocol-international-registration) allows a single international filing covering 130+ jurisdictions. The base fee is ~$653 + per-country fees. Recommended only when international commerce is established (e.g., paying European customers, EU office, etc.). Filed-not-blocking until trigger fires.

---

## Cross-references

- The trademark notice: [`TRADEMARK.md`](../../TRADEMARK.md)
- The operations runbook: [`docs/OPERATIONS.md`](../OPERATIONS.md)
- ADR 0006 (protocol-not-marketplace; brand protection rationale): [`docs/decisions/0006-protocol-not-marketplace.md`](../decisions/0006-protocol-not-marketplace.md)
- ADR 0008 (stable-mode posture; brand protection load-bearing): [`docs/decisions/0008-stable-mode-maintenance-posture.md`](../decisions/0008-stable-mode-maintenance-posture.md)
- USPTO TEAS: https://www.uspto.gov/trademarks/apply
- USPTO TESS (search): https://tmsearch.uspto.gov/
- USPTO TSDR (status): https://tsdr.uspto.gov/
