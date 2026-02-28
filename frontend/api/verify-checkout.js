// Vercel Serverless Function: Verify Stripe Checkout Session
// Endpoint: POST /api/verify-checkout
//
// After redirect from Stripe Checkout, the frontend calls this
// to verify payment and credit the user if webhook hasn't fired yet.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const CREDIT_PACKAGES = {
    starter:    { credits: 1000 },
    growth:     { credits: 5000 },
    agency:     { credits: 15000 },
    enterprise: { credits: 50000 },
};

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { session_id, user_id } = req.body;
        if (!session_id || !user_id) {
            return res.status(400).json({ error: 'session_id and user_id required' });
        }

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        const supabaseUrl = process.env.SUPABASE_URL || 'https://bvbxyrgqdjctnbyilzjj.supabase.co';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!stripeKey || !supabaseServiceKey) {
            return res.status(500).json({ error: 'Server not configured' });
        }

        const stripe = new Stripe(stripeKey);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Retrieve the Stripe session
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(200).json({ status: 'unpaid', message: 'Payment not completed yet' });
        }

        // Check if already processed
        const { data: existingSession } = await supabase
            .from('stripe_sessions')
            .select('*')
            .eq('session_id', session_id)
            .single();

        if (existingSession && existingSession.status === 'completed') {
            // Already credited — return current balance
            const { data: creditRow } = await supabase
                .from('credits')
                .select('balance')
                .eq('user_id', user_id)
                .single();

            return res.status(200).json({
                status: 'already_completed',
                balance: creditRow?.balance || 0,
            });
        }

        // Credit the user (fallback in case webhook didn't fire)
        const packageKey = session.metadata?.package_key;
        const creditsAmount = parseInt(session.metadata?.credits_amount || '0', 10);

        if (!creditsAmount) {
            return res.status(400).json({ error: 'Invalid session metadata' });
        }

        // Get or create credit balance
        let { data: creditRow, error: fetchErr } = await supabase
            .from('credits')
            .select('*')
            .eq('user_id', user_id)
            .single();

        if (fetchErr && fetchErr.code === 'PGRST116') {
            const { data: newRow, error: insertErr } = await supabase
                .from('credits')
                .insert({ user_id: user_id, balance: 0, lifetime_purchased: 0, lifetime_used: 0 })
                .select()
                .single();
            if (insertErr) throw insertErr;
            creditRow = newRow;
        } else if (fetchErr) {
            throw fetchErr;
        }

        const newBalance = (creditRow.balance || 0) + creditsAmount;
        const newLifetimePurchased = (creditRow.lifetime_purchased || 0) + creditsAmount;

        // Update balance
        await supabase.from('credits').update({
            balance: newBalance,
            lifetime_purchased: newLifetimePurchased,
            updated_at: new Date().toISOString(),
        }).eq('user_id', user_id);

        // Log transaction
        await supabase.from('credit_transactions').insert({
            user_id: user_id,
            type: 'purchase',
            amount: creditsAmount,
            balance_after: newBalance,
            description: `Purchased ${packageKey} pack — ${creditsAmount.toLocaleString()} credits`,
            metadata: { package_key: packageKey, price_cents: session.amount_total },
            stripe_session_id: session_id,
            stripe_payment_intent: session.payment_intent,
        });

        // Mark session completed
        await supabase.from('stripe_sessions').upsert({
            user_id: user_id,
            session_id: session_id,
            package_key: packageKey,
            credits_amount: creditsAmount,
            price_cents: session.amount_total,
            status: 'completed',
            payment_intent: session.payment_intent,
            completed_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });

        return res.status(200).json({
            status: 'completed',
            credits_added: creditsAmount,
            balance: newBalance,
        });
    } catch (err) {
        console.error('Verify checkout error:', err);
        return res.status(500).json({ error: err.message });
    }
};
