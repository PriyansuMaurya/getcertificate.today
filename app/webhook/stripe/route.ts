import { db } from '@/utils/db/db';
import { usersTable } from '@/utils/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/utils/stripe/api';
import type Stripe from 'stripe';

// Stripe webhook: signature-verified (RULES §9.1), idempotent updates for
// created/updated/deleted subscription lifecycle events (RULES §17.3),
// no payload logging (RULES §9.4).

function customerIdOf(sub: Stripe.Subscription): string {
  return typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Fail closed: never trust an unsigned payload (TASK.md Phase 0.2).
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error(
      '[stripe-webhook] signature verification failed:',
      err instanceof Error ? err.message : 'unknown error'
    );
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        // Store the subscription ID for active/trialing; reset to the 'none'
        // sentinel when the subscription is no longer live (updated event).
        const live = sub.status === 'active' || sub.status === 'trialing';
        await db
          .update(usersTable)
          .set({ plan: live ? sub.id : 'none' })
          .where(eq(usersTable.stripe_id, customerIdOf(sub)));
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await db
          .update(usersTable)
          .set({ plan: 'none' })
          .where(eq(usersTable.stripe_id, customerIdOf(sub)));
        break;
      }
      default:
        console.log(`[stripe-webhook] unhandled event type ${event.type}`);
    }

    return new Response('Success', { status: 200 });
  } catch (err) {
    console.error(
      '[stripe-webhook] handler error:',
      err instanceof Error ? err.message : 'unknown error'
    );
    // 500 so Stripe retries — updates are idempotent by design above.
    return new Response('Webhook handler error', { status: 500 });
  }
}
