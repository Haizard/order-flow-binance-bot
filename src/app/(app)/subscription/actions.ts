
'use server';

import { stripe } from '@/lib/stripe';
import { getSession } from '@/lib/session';
import { headers } from 'next/headers';

interface ActionResult {
  success: boolean;
  message: string;
  url?: string;
}

const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;

export async function handleCreateCheckoutSession(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Authentication required.' };
  }
  
  if (!STRIPE_PRO_PRICE_ID) {
      console.error("Stripe Pro Price ID is not configured in environment variables.");
      return { success: false, message: "Subscription service is currently unavailable. Please contact support." };
  }

  const host = headers().get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const successUrl = `${protocol}://${host}/dashboard?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${protocol}://${host}/subscription`;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Pass the user's ID to Stripe metadata to identify them in webhooks
      client_reference_id: session.id,
      customer_email: session.email,
    });

    if (!checkoutSession.url) {
        return { success: false, message: 'Could not create a Stripe checkout session.' };
    }

    return { success: true, message: 'Checkout session created.', url: checkoutSession.url };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    console.error('Error creating Stripe checkout session:', errorMessage);
    return { success: false, message: 'Failed to connect to the payment provider.' };
  }
}
