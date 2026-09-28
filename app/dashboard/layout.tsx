import DashboardHeader from "@/components/DashboardHeader";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { createClient } from '@/utils/supabase/server'
import { redirect } from "next/navigation"
import { hasCompletedOnboarding } from '@/app/auth/actions'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "SAAS Starter Kit",
    description: "SAAS Starter Kit with Stripe, Supabase, Postgres",
};

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Users must complete onboarding before seeing the dashboard.
    // Subscribing is a voluntary choice made inside the dashboard, never forced.
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    if (!(await hasCompletedOnboarding(user.id))) {
        redirect('/onboarding')
    }

    return (
        <html lang="en">
            <DashboardHeader />
            {children}
        </html>
    );
}
