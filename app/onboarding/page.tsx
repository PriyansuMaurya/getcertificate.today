import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from '@/utils/supabase/server'
import { hasCompletedOnboarding } from '@/app/auth/actions'
import { db } from '@/utils/db/db'
import { usersTable } from '@/utils/db/schema'
import { eq } from 'drizzle-orm'
import OnboardingForm from '@/components/OnboardingForm'

export const metadata = {
    title: 'Complete your profile',
    description: 'Set up your username and personal details',
}

export default async function Onboarding() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    if (await hasCompletedOnboarding(user.id)) {
        redirect('/dashboard')
    }

    const existing = await db
        .select({
            username: usersTable.username,
            first_name: usersTable.first_name,
            last_name: usersTable.last_name,
            dob: usersTable.dob,
        })
        .from(usersTable)
        .where(eq(usersTable.id, user.id))

    const profile = existing[0]

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
            <Card className="w-full max-w-[420px] sm:mx-auto">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Complete your profile</CardTitle>
                    <CardDescription>
                        Tell us a bit about yourself. You can change these details later.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <OnboardingForm
                        defaultUsername={profile?.username ?? undefined}
                        defaultFirstName={profile?.first_name ?? undefined}
                        defaultLastName={profile?.last_name ?? undefined}
                        defaultDob={profile?.dob ?? undefined}
                    />
                </CardContent>
            </Card>
        </div>
    )
}
