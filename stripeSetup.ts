import { config } from 'dotenv';
import Stripe from 'stripe';

if (process.env.NODE_ENV === 'production') {
  config(); // Load from .env in production
} else {
  config({ path: '.env.local' }); // Load from .env.local in development
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Types
interface Plan {
  name: string;
  price: number;
  description: string;
  features: string[];
}

interface StripeProduct {
  id: string;
  name: string;
  metadata?: {
    features?: string;
  };
}

interface WebhookEndpoint {
  url: string;
}

// Configuration
const PUBLIC_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000';
const CURRENCY = 'usd';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Product Plans
// Tiers must match components/SubscribePricingCards.tsx and the STRIPE_PRICE_*
// env price IDs. Product names are exact matches so re-running the script
// updates the existing products instead of creating duplicates.
const plans: Plan[] = [
  {
    name: 'Basic',
    price: 900, // $9/mo, price in cents
    description: 'Perfect for beginners',
    features: ['Access to selected courses', 'Community support', 'Progress tracking', 'Limited AI insights'],
  },
  {
    name: 'Most Popular',
    price: 1900, // $19/mo
    description: 'Best for consistent learners',
    features: ['Access to all courses', 'Personalized AI learning path', 'Priority support', 'Certificates of completion', 'Weekly progress reports'],
  },
  {
    name: 'Premium',
    price: 3900, // $39/mo
    description: 'For ambitious learners',
    features: ['Unlimited course access', '1-on-1 mentor sessions', 'Advanced AI performance analytics', 'Exclusive webinars & resources', 'Lifetime certificate access'],
  },
];

// Helper Functions
async function createProduct(plan: Plan): Promise<StripeProduct> {
  // Check if product exists
  const existingProducts = await stripe.products.list({ active: true });
  let product = existingProducts.data.find((p: StripeProduct) => p.name === plan.name);

  if (!product) {
    // Create new product if it doesn't exist
    product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        features: JSON.stringify(plan.features),
      },
    });
    console.log(`Created product: ${plan.name}`);
  } else {
    // Update existing product's features
    product = await stripe.products.update(product.id, {
      description: plan.description,
      metadata: {
        features: JSON.stringify(plan.features),
      },
    });
    console.log(`Updated product: ${plan.name}`);
  }

  return product;
}

async function createPrice(product: StripeProduct, plan: Plan): Promise<void> {
  // Check if price exists
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
  });

  if (existingPrices.data.length === 0) {
    // Create new price if none exists
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.price,
      currency: CURRENCY,
      recurring: { interval: 'month' },
    });

    // Set as default price
    await stripe.products.update(product.id, {
      default_price: price.id,
    });
    console.log(`Created price for ${plan.name}: ${price.id}`);
  }
}

async function setupWebhook(): Promise<void> {
  // Skip webhook setup in development
  if (!IS_PRODUCTION) {
    console.log('Skipping webhook setup in development');
    console.log('Use Stripe CLI for local testing: https://stripe.com/docs/stripe-cli');
    return;
  }

  const webhooks = await stripe.webhookEndpoints.list();
  const webhookUrl = `${PUBLIC_URL}/webhook/stripe`;

  if (!webhooks.data.some((webhook: WebhookEndpoint) => webhook.url === webhookUrl)) {
    await stripe.webhookEndpoints.create({
      enabled_events: [
        'customer.subscription.created',
        'customer.subscription.deleted',
        'customer.subscription.updated',
      ],
      url: webhookUrl,
    });
    console.log('Created webhook endpoint');
  }
}

// Main Setup Function
async function setupStripe(): Promise<void> {
  try {
    console.log(`Setting up Stripe in ${IS_PRODUCTION ? 'production' : 'development'} mode...`);

    // Setup products and prices
    for (const plan of plans) {
      const product = await createProduct(plan);
      await createPrice(product, plan);
    }

    // Setup webhook
    await setupWebhook();

    console.log('Stripe setup completed successfully');
  } catch (error) {
    console.error('Error setting up Stripe:', error);
    throw error;
  }
}

// Run Setup
setupStripe().catch(console.error);
