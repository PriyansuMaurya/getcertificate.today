import type { Metadata } from 'next';
import { requireAdmin } from '../require-admin';
import { getSettings } from '@/utils/settings';
import SettingsForm from '@/components/admin/SettingsForm';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function AdminSettingsPage() {
  await requireAdmin();

  // Live values from app_settings (falls back to the historical defaults when
  // no row has been saved yet), so the form always shows current state.
  const settings = await getSettings();

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Settings</h1>
        <p className="max-w-2xl text-sm text-clay sm:text-base">
          Platform-wide values that drive assessment generation, scoring, attempt limits, and the
          free plan. They apply to every user and take effect immediately.
        </p>
      </div>

      <div className="mt-8">
        <SettingsForm initialSettings={settings} />
      </div>
    </div>
  );
}
