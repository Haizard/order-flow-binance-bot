
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { getSettings, saveSettings } from '@/services/settingsService';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
        
        // The user ID was passed in client_reference_id when the session was created
        const userId = session.client_reference_id;
        
        if (!userId) {
            console.error('Webhook Error: checkout.session.completed event received without client_reference_id (userId).');
            // We can't do anything without the user ID, so we return a success response to Stripe
            // to prevent retries for an unprocessable event.
            return NextResponse.json({ received: true, message: "No user ID found in session." });
        }

        try {
            console.log(`Webhook: Activating subscription for user ID: ${userId}`);
            
            // Fetch the user's current settings
            const userSettings = await getSettings(userId);
            
            // Update the subscription status
            userSettings.hasActiveSubscription = true;
            
            // Save the updated settings back to the database
            await saveSettings(userId, userSettings);

            console.log(`Webhook: Successfully activated subscription for user ID: ${userId}`);
            
        } catch (dbError) {
             console.error(`Webhook Error: Failed to update subscription status for user ID: ${userId}. Error:`, dbError);
             // If there's a database error, we should return a 500 to let Stripe know something went wrong
             // on our end, so it can retry the webhook delivery.
             return new NextResponse('Internal Server Error: Could not update user subscription.', { status: 500 });
        }
    }
    
    // Add logic here for other events like `customer.subscription.deleted` if you want to handle cancellations.

    // Return a 200 response to acknowledge receipt of the event
    return NextResponse.json({ received: true });
}
