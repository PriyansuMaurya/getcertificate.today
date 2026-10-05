'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/utils/db/db';
import { appSettingsTable } from '@/utils/db/schema';
import { getSettings, settingsToRow, validateSettings, SETTINGS_ROW_ID } from '@/utils/settings';
import type { AppSettings, SettingsErrors } from '@/utils/settings-config';
import { requireAdmin } from '../require-admin';

export type AdminSettingsActionState = {
  message: string;
  success?: boolean;
  /** Field-level errors from server-side validation (never trust the client). */
  errors?: SettingsErrors;
  /**
   * Set when the values differ from what is stored and the caller has not
   * confirmed. The write is withheld and the UI must present the changes and
   * resubmit with `confirmImpact=yes` - the confirmation is enforced here, not
   * only in the browser.
   */
  needsConfirmation?: boolean;
  /** The settings that would change (keys only; the UI owns the copy). */
  changedFields?: (keyof AppSettings)[];
  /** Echo of the persisted values, used to re-sync the form baseline. */
  values?: AppSettings;
};

/** Which submitted settings differ from what is currently stored. */
function changedKeys(current: AppSettings, next: AppSettings): (keyof AppSettings)[] {
  return (Object.keys(current) as (keyof AppSettings)[]).filter(
    (key) => current[key] !== next[key]
  );
}

/**
 * Persist platform settings.
 *
 * Authorization is server-side: requireAdmin() redirects signed-out callers to
 * /login and 404s non-admins (and suspended admins) before anything runs, so
 * hiding the form in the UI is never the security boundary.
 *
 * Every field is re-validated here (utils/settings.ts) - the browser's native
 * min/max is only a convenience. Changing any value requires an explicit
 * `confirmImpact=yes` acknowledgement because these values affect every user;
 * a caller that skips it gets `needsConfirmation` instead of a write.
 */
export async function updateSettings(
  _currentState: AdminSettingsActionState,
  formData: FormData
): Promise<AdminSettingsActionState> {
  await requireAdmin();

  const parsed = validateSettings(formData);
  if ('errors' in parsed) {
    return { message: 'Please fix the highlighted values and try again.', errors: parsed.errors };
  }

  const current = await getSettings();
  const changedFields = changedKeys(current, parsed.settings);
  const confirmed = formData.get('confirmImpact') === 'yes';

  if (changedFields.length > 0 && !confirmed) {
    return {
      message: 'These changes need confirmation before they are saved.',
      needsConfirmation: true,
      changedFields,
    };
  }

  const fields = settingsToRow(parsed.settings);
  try {
    const now = new Date();
    await db
      .insert(appSettingsTable)
      .values({ id: SETTINGS_ROW_ID, ...fields, updated_at: now })
      .onConflictDoUpdate({
        target: appSettingsTable.id,
        set: { ...fields, updated_at: now },
      });
  } catch (err) {
    console.error(
      '[admin] settings save failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return { message: 'Could not save settings. Please try again.' };
  }

  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  return {
    message: 'Settings saved. New assessments, attempts, and quotas use these values immediately.',
    success: true,
    values: parsed.settings,
  };
}
