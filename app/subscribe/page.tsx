import StripePricingTable from "@/components/StripePricingTable";
import Image from "next/image"
import { createClient } from '@/utils/supabase/server'
import { createStripeCheckoutSession } from "@/utils/stripe/api";
export default async function Subscribe() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    const checkoutSessionSecret = await createStripeCheckoutSession(user!.email!)

    return (
        <div className="flex flex-col min-h-screen bg-secondary">
            <header className="sticky top-0 z-50 flex h-16 w-full items-center border-b border-b-slate-200 bg-white px-4 lg:px-6">
                <Image src="/logo.png" alt="logo" width={50} height={50} />
                <span className="sr-only">Acme Inc</span>
            </header>
            <div className="w-full px-4 py-16 sm:px-6 md:py-24 lg:py-32">
                <div className="mx-auto max-w-[1200px] text-center py-6 md:py-10">
                    <h1 className="font-bold text-xl md:text-3xl lg:text-4xl ">Pricing</h1>
                    <h1 className="pt-4 text-muted-foreground text-sm md:text-base lg:text-lg">Choose the right plan for your team! Cancel anytime!</h1>
                </div>
                <div className="mx-auto w-full max-w-[1200px]">
                    <StripePricingTable checkoutSessionSecret={checkoutSessionSecret} />
                </div>
            </div>
        </div>
    )
}