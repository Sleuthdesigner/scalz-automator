// Vercel Serverless Function: Create Stripe Checkout Session
// Endpoint: POST /api/create-checkout
//
// Creates a Stripe Checkout session for credit purchases.
// The frontend redirects the user to Stripe's hosted checkout page.

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Credit packages — must match frontend config
const CREDIT_PACKAGES = {
    starter: {
        name: 'Starter Pack',
        credits: 1000,
        price_id: 'price_1T5cVWLtjWCgOmXDg9zQy3SC',
        price_cents: 2900,
    },
    growth: {
        name: 'Growth Pack',
        credits: 5000,
        price_id: 'price_1T5cVfLtjWCgOmXDh6turnKf',
        price_cents: 7900,
    },
    agency: {
        name: 'Agency Pack',
        credits: 15000,
        price_id: 'price_1T5cVdLtjWCgOmXDxXHQueu9',
        price_cents: 14900,
    },
    enterprise: {
        name: 'Enterprise Pack',
        credits: 50000,
        price_id: 'price_1T5cVgLtjWCgOmXD4s4LlW9y',
        price_cents: 39900,
    },
};

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { package_key, user_id, user_email, success_url, cancel_url } = req.body;

        if (!package_key || !CREDIT_PACKAGES[package_key]) {
            return res.status(400).json({ error: 'Invalid package. Choose: starter, growth, agency, enterprise' });
        }
        if (!user_id || !user_email) {
            return res.status(400).json({ error: 'user_id and user_email are required' });
        }

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            return res.status(500).json({ error: 'Stripe secret key not configured. Add STRIPE_SECRET_KEY to Vercel env vars.' });
        }

        const stripe = new Stripe(stripeKey);
        const pkg = CREDIT_PACKAGES[package_key];

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            customer_email: user_email,
            line_items: [{
                price: pkg.price_id,
                quantity: 1,
            }],
            metadata: {
                user_id,
                package_key,
                credits_amount: String(pkg.credits),
            },
            success_url: success_url || `${req.headers.origin || 'https://app.scalz.ai'}/#credits?session_id={CHECKOUT_SESSION_ID}&status=success`,
            cancel_url: cancel_url || `${req.headers.origin || 'https://app.scalz.ai'}/#credits?status=cancelled`,
        });

        // Track the session in Supabase
        const supabaseUrl = process.env.SUPABASE_URL || 'https://bvbxyrgqdjctnbyilzjj.supabase.co';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

        if (supabaseServiceKey) {
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            await supabase.from('stripe_sessions').insert({
                user_id,
                session_id: session.id,
                package_key,
                credits_amount: pkg.credits,
                price_cents: pkg.price_cents,
                status: 'pending',
            });
        }

        return res.status(200).json({
            session_id: session.id,
            checkout_url: session.url,
        });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        return res.status(500).json({ error: err.message });
    }
};
