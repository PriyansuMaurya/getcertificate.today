import Image from 'next/image';
import Link from 'next/link';
import DashboardNavLinks from './DashboardNavLinks';

export default function DashboardSidebar() {
  return (
    <aside
      aria-label="Dashboard navigation"
      className="hidden min-h-screen w-[280px] shrink-0 border-r border-sandline bg-paper lg:block"
    >
      <div className="sticky top-0 flex h-screen flex-col px-8 py-8">
        <Link href="/dashboard" aria-label="getcertificate.today dashboard">
          <Image
            src="/figma/logo.png"
            alt="getcertificate.today"
            width={180}
            height={40}
            priority
            className="h-10 w-[180px]"
          />
        </Link>
        <div className="mt-12">
          <DashboardNavLinks />
        </div>
        <div className="mt-auto">
          <p className="text-xs leading-relaxed text-clay">
            Learn Today. Go Further. - turning YouTube video minutes into verifiable credentials.
          </p>
        </div>
      </div>
    </aside>
  );
}
