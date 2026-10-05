import type { Metadata } from 'next';
import { requireAdmin } from '../require-admin';

export const metadata: Metadata = {
  title: 'Credentials',
};

export default async function AdminCredentialsPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <h1 className="font-fraunces text-3xl font-black text-ink sm:text-4xl">Credentials</h1>
        <p className="text-sm text-clay sm:text-base">
          Issued credentials, revocations, and verification traffic.
        </p>
      </div>

      <section
        aria-labelledby="credentials-placeholder-heading"
        className="mt-8 rounded-2xl border border-sandline bg-paper p-5 sm:p-8"
      >
        <h2
          id="credentials-placeholder-heading"
          className="font-fraunces text-xl font-bold text-ink"
        >
          Nothing to show yet
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-clay">
          Credential issuance history and revocation tools will appear here.
        </p>
      </section>
    </div>
  );
}
