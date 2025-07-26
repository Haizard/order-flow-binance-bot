
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getSettings, saveSettings } from '@/services/settingsService';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Define your product price IDs from environment variables
const PRO_TRADER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_123_pro';
const MT5_BOT_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_MT5_PRICE_ID || 'price_123_mt5';


export async function POST(req: Request) {
    if (!webhookSecret) {
        console.error("CRITICAL: STRIPE_WEBHOOK_SECRET is not set. Cannot process webhooks.");
        return new NextResponse("Webhook secret not configured.", { status: 500 });
    }

    const body = await req.text();
    const sig = headers().get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
        const errorMessage = `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error(errorMessage);
        return new NextResponse(errorMessage, { status: 400 });
    }
    
    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        const userId = session.client_reference_id;
        
        if (!userId) {
            console.error('Webhook Error: checkout.session.completed event received without client_reference_id (userId).');
            return NextResponse.json({ received: true, message: "No user ID found in session." });
        }

        try {
            console.log(`Webhook: Activating subscription for user ID: ${userId}`);
            
            // Fetch the user's current settings
            const userSettings = await getSettings(userId);
            
            // Update the subscription status based on the product purchased.
            // This is a simple example. A real app might have different fields for different products.
            userSettings.hasActiveSubscription = true;

            // Optionally, you could store which plan they bought:
            // if (session.metadata?.priceId === PRO_TRADER_PRICE_ID) {
            //   userSettings.activePlan = 'pro_trader';
            // } else if (session.metadata?.priceId === MT5_BOT_PRICE_ID) {
            //   userSettings.activePlan = 'mt5_bot';
            // }
            
            // Save the updated settings back to the database
            await saveSettings(userId, userSettings);

            console.log(`Webhook: Successfully activated subscription for user ID: ${userId}`);
            
        } catch (dbError) {
             console.error(`Webhook Error: Failed to update subscription status for user ID: ${userId}. Error:`, dbError);
             return new NextResponse('Internal Server Error: Could not update user subscription.', { status: 500 });
        }
    }
    
    // Add logic here for other events like `customer.subscription.deleted` to handle cancellations.

    return NextResponse.json({ received: true });
}
