import type { ConventionStatus } from "@devdigest/shared";

/* Mirrors ConventionStatus from @devdigest/shared — value imports from the
   vendored package crash webpack (client INSIGHTS), so the enum lives here. */
export const CONVENTION_STATUS = {
  pending: "pending",
  accepted: "accepted",
  rejected: "rejected",
} as const satisfies Record<ConventionStatus, ConventionStatus>;

/** Confidence thresholds (0..1) for the bar colour. */
export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MID = 0.65;
