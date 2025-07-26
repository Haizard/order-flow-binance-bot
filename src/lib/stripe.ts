
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: STRIPE_SECRET_KEY is not set in production environment.');
  }
  console.warn('Stripe secret key is not set. Using a dummy key for development.');
}

export const stripe = new Stripe(stripeSecretKey || 'sk_test_dummy_key_for_dev', {
  apiVersion: '2024-06-20',
  typescript: true,
});
