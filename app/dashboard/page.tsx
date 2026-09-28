import { redirect } from 'next/navigation'

import { createClient } from '@/utils/supabase/server'

export default async function Dashboard() {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
        redirect('/login')
    }

    return (
        <main className="min-h-dvh flex-1">
            <div className="container px-4 py-10 md:py-16">
                <h1 className="break-words text-lg md:text-2xl">
                    Hello {data.user.email}
                </h1>
            </div>
        </main>)

}