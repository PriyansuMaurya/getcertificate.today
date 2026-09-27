"use client"
import React from 'react';

// Deliberate cast: stripe-pricing-table is a Stripe custom element, typed here
// instead of a global JSX namespace augmentation (keeps no-namespace lint rule happy).
const StripePricingTableElement = 'stripe-pricing-table' as React.ElementType;

export default function StripePricingTable({ checkoutSessionSecret }: { checkoutSessionSecret: string }) {

    return (
        <StripePricingTableElement
            pricing-table-id={process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID}
            publishable-key={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
            customer-session-client-secret={checkoutSessionSecret}
        >
        </StripePricingTableElement>
    )


};
