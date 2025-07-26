
'use server';

import { stripe } from '@/lib/stripe';
import { getSession } from '@/lib/session';
import { headers } from 'next/headers';

interface ActionResult {
  success: boolean;
  message: string;
  url?: string;
}

export async function handleCreateCheckoutSession(priceId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Authentication required.' };
  }
  
  if (!priceId) {
      console.error("Stripe Price ID was not provided to the checkout action.");
      return { success: false, message: "Subscription plan ID is missing. Please contact support." };
  }

  const host = headers().get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const successUrl = `${protocol}://${host}/dashboard?subscription_success=true`;
  const cancelUrl = `${protocol}://${host}/subscription`;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: session.id,
      customer_email: session.email,
      // Add metadata to know which product was purchased in the webhook
      metadata: {
          priceId: priceId
      }
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

export async function handleCreateBinancePayOrder(): Promise<ActionResult> {
    const session = await getSession();
    if (!session) {
        return { success: false, message: 'Authentication required.' };
    }

    // --- Placeholder for Binance Pay Integration ---
    // In a real implementation, you would use the Binance Pay SDK here.
    // ------------------------------------------------

    console.log(`Binance Pay action triggered for user: ${session.email}`);
    return {
        success: false, // Set to false to prevent redirection
        message: "Binance Pay integration is not yet complete. This is a placeholder.",
        url: undefined
    };
}
