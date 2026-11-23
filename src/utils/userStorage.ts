/**
 * Per-account storage namespacing.
 *
 * Every piece of personal data (profile, tasks, schedule, focus history, AI chat)
 * is saved under `<base>::<userId>` so several accounts can share one device
 * without seeing each other's information. Device-wide preferences (theme,
 * appearance, language) stay global.
 */

/** Keys holding personal data. They existed before accounts did. */
export const USER_SCOPED_KEYS = [
  'studia_profile_v1',
  'studia_tasks_v1',
  'studia_schedule_v1',
  'studia_focus_v1',
  'studia_ai_v1',
] as const;

let currentUserId: string | null = null;

export function setStorageUser(userId: string | null) {
  currentUserId = userId;
}

export function getStorageUser() {
  return currentUserId;
}

/** Resolves the storage key for the signed-in account. */
export function userKey(base: string): string {
  return currentUserId ? `${base}::${currentUserId}` : base;
}

/**
 * The first account created on a device adopts any data saved before
 * accounts existed, so nobody loses their tasks after updating.
 */
export function adoptLegacyData(userId: string) {
  try {
    for (const base of USER_SCOPED_KEYS) {
      const legacy = localStorage.getItem(base);
      const scoped = `${base}::${userId}`;
      if (legacy !== null && localStorage.getItem(scoped) === null) {
        localStorage.setItem(scoped, legacy);
        localStorage.removeItem(base);
      }
    }
  } catch {
    // Storage unavailable: nothing to migrate.
  }
}

