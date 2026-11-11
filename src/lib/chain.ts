// VVU chain append — the single source of truth for "what happened".
// Every state transition (build, share, view, revoke, export, delete) flows
// through here so the chain is never bypassed.

import { db } from "@/lib/db";
import { appendEvent, canonicalize, GENESIS_HASH, sha256Hex } from "@/lib/worm";

export type AppendInput = {
  buildId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export async function appendChainEvent({
  buildId,
  eventType,
  payload,
}: AppendInput) {
  // the previous link — genesis for the first event on a build
  const last = await db.chainEvent.findFirst({
    where: { buildId },
    orderBy: { seq: "desc" },
  });
  const prevHash = last?.chainHash ?? GENESIS_HASH;
  const seq = (last?.seq ?? -1) + 1;

  const link = appendEvent(prevHash, eventType, payload);

  return db.chainEvent.create({
    data: {
      buildId,
      seq,
      eventType,
      payload: link.payload,
      sourceHash: link.sourceHash,
      chainHash: link.chainHash,
    },
  });
}

/** Convenience: build the twin fingerprint (SHA-256 of a canonical descriptor). */
export function twinHashOf(descriptor: Record<string, unknown>): string {
  return sha256Hex(canonicalize(descriptor));
}
