import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReceiptText, User, LogOut, ExternalLink, Settings, BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { logout } from '@/app/auth/actions';
import { generateStripeBillingPortalLink } from '@/utils/stripe/api';

export default async function DashboardHeaderProfileDropdown() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let billingPortalURL: string | null = null;
  if (user?.email) {
    try {
      billingPortalURL = await generateStripeBillingPortalLink(user.email);
    } catch {
      // Stripe unavailable — degrade to a disabled hint instead of a dead link.
      billingPortalURL = null;
    }
  }

  const initial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-sandline bg-paper font-fraunces text-sm font-bold text-ink shadow-sm transition-colors hover:border-ink hover:bg-cream focus:outline-none"
            aria-label="Open user menu"
          >
            {initial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 rounded-xl border border-sandline bg-paper p-2 text-ink shadow-figma-pro"
        >
          <DropdownMenuLabel className="px-2 py-1.5 font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-sand">Signed in as</p>
              <p className="truncate text-sm font-semibold text-ink">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1 bg-sandline" />

          {/* shadcn pattern: DropdownMenuItem-asChild wrapping Link — avoids the
              invalid Link-inside-Link nesting (MEMORY §6.3). */}
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/dashboard" className="rounded-lg px-2.5 py-2 text-sm font-medium text-ink">
              <User className="mr-2.5 h-4 w-4 text-clay" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link
              href="/dashboard/certificates"
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-ink"
            >
              <BadgeCheck className="mr-2.5 h-4 w-4 text-clay" />
              <span>Certificates</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link
              href="/dashboard/settings"
              className="rounded-lg px-2.5 py-2 text-sm font-medium text-ink"
            >
              <Settings className="mr-2.5 h-4 w-4 text-clay" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>

          {billingPortalURL ? (
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link
                href={billingPortalURL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-ink"
              >
                <ReceiptText className="mr-2.5 h-4 w-4 text-clay" />
                <span>Manage Billing</span>
                <ExternalLink className="ml-auto h-3 w-3 text-clay" />
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="px-2.5 py-2 text-sm font-medium">
              <ReceiptText className="mr-2.5 h-4 w-4" />
              <span>Billing unavailable</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1 bg-sandline" />

          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-700"
          >
            <form action={logout} className="w-full">
              <button type="submit" className="flex w-full items-center">
                <LogOut className="mr-2.5 h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
