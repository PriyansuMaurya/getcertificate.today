import Link from "next/link"
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/utils/db/db'
import { usersTable } from '@/utils/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from "@/components/ui/button"

export default async function Dashboard() {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
        redirect('/login')
    }

    const profileRows = await db
        .select({
            username: usersTable.username,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            plan: usersTable.plan,
        })
        .from(usersTable)
        .where(eq(usersTable.id, data.user.id))

    const profile = profileRows[0]
    const displayName =
        profile?.first_name && profile?.last_name
            ? `${profile.first_name} ${profile.last_name}`
            : profile?.username ?? data.user.email
    const isSubscribed = Boolean(profile && profile.plan && profile.plan !== 'none')

    return (
        <main className="min-h-dvh flex-1">
            <div className="container px-4 py-10 md:py-16">
                <h1 className="break-words text-lg md:text-2xl">
                    Welcome back, {displayName}
                </h1>

                {!isSubscribed && (
                    <div className="mt-6 max-w-md rounded-lg border bg-card p-6 shadow-sm">
                        <h2 className="text-base font-semibold">Upgrade your plan</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Unlock more features by subscribing to a paid plan. Completely optional —
                            only if you want to.
                        </p>
                        <Button asChild className="mt-4">
                            <Link href="/subscribe">See plans &amp; pricing</Link>
                        </Button>
                    </div>
                )}
            </div>
        </main>
    )
}
