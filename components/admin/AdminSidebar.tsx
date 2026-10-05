import Image from 'next/image';
import Link from 'next/link';
import AdminNavLinks from './AdminNavLinks';

// Admin console sidebar. Mirrors DashboardSidebar (280px, border-r, bg-paper,
// sticky h-screen) so the shell shares the product's exact visual language;
// only the nav set and footer note differ.
export default function AdminSidebar() {
  return (
    <aside
      aria-label="Admin navigation"
      className="hidden min-h-screen w-[280px] shrink-0 border-r border-sandline bg-paper lg:block"
    >
      <div className="sticky top-0 flex h-screen flex-col px-8 py-8">
        <Link href="/admin" aria-label="getcertificate.today admin overview">
          <Image
            src="/figma/logo-no-tagline.svg"
            alt="getcertificate.today"
            width={1339}
            height={767}
            priority
            unoptimized
            className="h-10 w-auto"
          />
        </Link>
        <p className="mt-3 text-[13px] font-bold uppercase tracking-wider text-sand">Admin</p>
        <div className="mt-10">
          <AdminNavLinks />
        </div>
        <div className="mt-auto">
          <p className="text-xs leading-relaxed text-clay">
            Internal console. Changes made here affect every user on the platform.
          </p>
        </div>
      </div>
    </aside>
  );
}
