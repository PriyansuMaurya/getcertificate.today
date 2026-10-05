import type { Metadata } from 'next';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { requireAdmin } from './require-admin';

export const metadata: Metadata = {
  title: {
    default: 'Admin | getcertificate.today',
    template: '%s | Admin | getcertificate.today',
  },
  description: 'Internal admin console for getcertificate.today.',
  // The console must never surface in search results. Child pages inherit
  // this unless they export their own `robots` - don't drop it there.
  robots: { index: false, follow: false },
};

// Single authorization choke point for every /admin route: layouts re-run
// server-side on each request, so a non-admin can never render child pages.
// Signed out -> /login; signed-in non-admin -> 404 (see require-admin.ts).
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Guard also supplies the identity, so the header never re-queries auth.
  const user = await requireAdmin();

  // Same shell as the dashboard: 280px sidebar column on lg+, header + main
  // beside it, with a keyboard bypass link ahead of the chrome.
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-bold focus:text-cream focus:shadow-figma-pro"
      >
        Skip to main content
      </a>
      <AdminSidebar />
      <div className="min-w-0">
        <AdminHeader email={user.email ?? ''} />
        <main id="main-content" className="min-h-[calc(100dvh-80px)] bg-cream text-ink">
          {children}
        </main>
      </div>
    </div>
  );
}
