// Vercel Serverless Function: Stripe Webhook Handler
// Endpoint: POST /api/stripe-webhook
//
// Handles Stripe webhook events (checkout.session.completed)
// Credits the user's account after successful payment.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Credit packages — must match create-checkout.js
const CREDIT_PACKAGES = {
    starter:    { credits: 1000 },
    growth:     { credits: 5000 },
    agency:     { credits: 15000 },
    enterprise: { credits: 50000 },
};

// Vercel requires raw body for webhook signature verification
// Add this to vercel.json: { "functions": { "api/stripe-webhook.js": { "maxDuration": 30 } } }
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, stripe-signature');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const supabaseUrl = process.env.SUPABASE_URL || 'https://bvbxyrgqdjctnbyilzjj.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!stripeKey || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Server not configured. Set STRIPE_SECRET_KEY and SUPABASE_SERVICE_KEY.' });
    }

    const stripe = new Stripe(stripeKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let event;

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
        const sig = req.headers['stripe-signature'];
        try {
            // For Vercel, req.body may already be parsed; use raw body if available
            const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).json({ error: `Webhook Error: ${err.message}` });
        }
    } else {
        // No webhook secret — trust the event (for development)
        event = req.body;
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const packageKey = session.metadata?.package_key;
        const creditsAmount = parseInt(session.metadata?.credits_amount || '0', 10);

        if (!userId || !creditsAmount) {
            console.error('Missing metadata in checkout session:', session.id);
            return res.status(400).json({ error: 'Missing user_id or credits_amount in session metadata' });
        }

        try {
            // 1. Get or create credit balance
            let { data: creditRow, error: fetchErr } = await supabase
                .from('credits')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (fetchErr && fetchErr.code === 'PGRST116') {
                // No row exists — create one
                const { data: newRow, error: insertErr } = await supabase
                    .from('credits')
                    .insert({ user_id: userId, balance: 0, lifetime_purchased: 0, lifetime_used: 0 })
                    .select()
                    .single();
                if (insertErr) throw insertErr;
                creditRow = newRow;
            } else if (fetchErr) {
                throw fetchErr;
            }

            const newBalance = (creditRow.balance || 0) + creditsAmount;
            const newLifetimePurchased = (creditRow.lifetime_purchased || 0) + creditsAmount;

            // 2. Update credit balance
            const { error: updateErr } = await supabase
                .from('credits')
                .update({
                    balance: newBalance,
                    lifetime_purchased: newLifetimePurchased,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);
            if (updateErr) throw updateErr;

            // 3. Log the transaction
            const { error: txErr } = await supabase
                .from('credit_transactions')
                .insert({
                    user_id: userId,
                    type: 'purchase',
                    amount: creditsAmount,
                    balance_after: newBalance,
                    description: `Purchased ${packageKey} pack — ${creditsAmount.toLocaleString()} credits`,
                    metadata: { package_key: packageKey, price_cents: session.amount_total },
                    stripe_session_id: session.id,
                    stripe_payment_intent: session.payment_intent,
                });
            if (txErr) throw txErr;

            // 4. Update stripe_sessions table
            await supabase
                .from('stripe_sessions')
                .update({
                    status: 'completed',
                    payment_intent: session.payment_intent,
                    completed_at: new Date().toISOString(),
                })
                .eq('session_id', session.id);

            console.log(`Credits added: ${creditsAmount} for user ${userId}. New balance: ${newBalance}`);
        } catch (err) {
            console.error('Error processing credit purchase:', err);
            return res.status(500).json({ error: 'Failed to process credit purchase' });
        }
    }

    return res.status(200).json({ received: true });
};
