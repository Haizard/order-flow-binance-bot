
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
  // After a successful payment, Stripe will redirect the user to the dashboard.
  const successUrl = `${protocol}://${host}/dashboard?subscription_success=true`;
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

export async function handleCreateBinancePayOrder(): Promise<ActionResult> {
    const session = await getSession();
    if (!session) {
        return { success: false, message: 'Authentication required.' };
    }

    // --- Placeholder for Binance Pay Integration ---
    // In a real implementation, you would use the Binance Pay SDK here
    // to create an order and get a checkout URL.
    //
    // Example steps:
    // 1. Check for BINANCE_PAY_API_KEY and SECRET in .env
    // 2. Initialize Binance Pay client
    // 3. Create an order with details like:
    //    - merchant_order_id (a unique ID from your system)
    //    - order_amount (e.g., 29.99)
    //    - currency (e.g., 'USDT')
    //    - goods_name ('Pro Trader Subscription')
    //    - webhook_url (for receiving payment confirmation)
    // 4. The SDK would return a checkoutUrl.
    // 5. Return that URL in the success response.
    // ------------------------------------------------

    console.log(`Binance Pay action triggered for user: ${session.email}`);
    return {
        success: false, // Set to false to prevent redirection
        message: "Binance Pay integration is not yet complete. This is a placeholder.",
        url: undefined
    };
}
