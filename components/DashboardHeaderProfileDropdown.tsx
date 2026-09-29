import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReceiptText, User, LogOut, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { logout } from '@/app/auth/actions';
import { generateStripeBillingPortalLink } from '@/utils/stripe/api';

export default async function DashboardHeaderProfileDropdown() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let billingPortalURL = '#';
  if (user?.email) {
    try {
      billingPortalURL = await generateStripeBillingPortalLink(user.email);
    } catch {
      // Billing portal unavailable
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

          <Link href="/dashboard">
            <DropdownMenuItem className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-ink focus:bg-cream focus:text-ink">
              <User className="mr-2.5 h-4 w-4 text-clay" />
              <span>Dashboard</span>
            </DropdownMenuItem>
          </Link>

          <Link href={billingPortalURL} target={billingPortalURL !== '#' ? '_blank' : undefined}>
            <DropdownMenuItem className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-ink focus:bg-cream focus:text-ink">
              <ReceiptText className="mr-2.5 h-4 w-4 text-clay" />
              <span>Manage Billing</span>
              {billingPortalURL !== '#' && <ExternalLink className="ml-auto h-3 w-3 text-clay" />}
            </DropdownMenuItem>
          </Link>

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
