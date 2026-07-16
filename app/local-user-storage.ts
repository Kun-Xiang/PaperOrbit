export const LEGACY_STORAGE = {
  saved: "paper-orbit:saved",
  read: "paper-orbit:read",
  reports: "paper-orbit:reports",
  interests: "paper-orbit:interests",
  affinity: "paper-orbit:affinity-v3",
  legacyAffinity: "paper-orbit:affinity-v2",
  feedback: "paper-orbit:paper-feedback-v1",
  candidates: "paper-orbit:candidate-pool-v1",
  refresh: "paper-orbit:last-refresh-v3",
};

export const LEGACY_STORAGE_CLAIM_KEY =
  "paper-orbit:legacy-storage-claim-v1";

export function storageKeysFor(email: string) {
  const scope = encodeURIComponent(email.trim().toLowerCase());
  const prefix = `paper-orbit:user:${scope}`;
  return {
    saved: `${prefix}:saved`,
    read: `${prefix}:read`,
    reports: `${prefix}:reports`,
    interests: `${prefix}:interests`,
    affinity: `${prefix}:affinity-v3`,
    legacyAffinity: `${prefix}:affinity-v2`,
    feedback: `${prefix}:paper-feedback-v1`,
    candidates: `${prefix}:candidate-pool-v1`,
    refresh: `${prefix}:last-refresh-v3`,
  };
}

export function claimLegacyStorage(
  local: Pick<Storage, "getItem" | "setItem">,
  scoped: ReturnType<typeof storageKeysFor>,
  email: string,
  canClaim: boolean,
) {
  if (!canClaim) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const currentClaim = local.getItem(LEGACY_STORAGE_CLAIM_KEY);
  if (currentClaim && currentClaim !== normalizedEmail) return false;
  if (!currentClaim) {
    local.setItem(LEGACY_STORAGE_CLAIM_KEY, normalizedEmail);
  }

  for (const name of Object.keys(LEGACY_STORAGE) as Array<
    keyof typeof LEGACY_STORAGE
  >) {
    if (local.getItem(scoped[name]) !== null) continue;
    const legacyValue = local.getItem(LEGACY_STORAGE[name]);
    if (legacyValue !== null) local.setItem(scoped[name], legacyValue);
  }
  return true;
}
