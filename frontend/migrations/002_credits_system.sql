-- =============================================
-- SCALZ SEO AUTOMATOR — Credit System Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Credit balances per user
CREATE TABLE IF NOT EXISTS credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    lifetime_purchased INTEGER NOT NULL DEFAULT 0,
    lifetime_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 2. Credit transaction log (purchases, usage, adjustments)
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'adjustment', 'bonus', 'refund')),
    amount INTEGER NOT NULL,  -- positive for additions, negative for usage
    balance_after INTEGER NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Stripe checkout sessions tracking
CREATE TABLE IF NOT EXISTS stripe_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL UNIQUE,
    package_key TEXT NOT NULL,
    credits_amount INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'failed')),
    payment_intent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credits_user_id ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_session_id ON stripe_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_stripe_sessions_user_id ON stripe_sessions(user_id);

-- RLS policies
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_sessions ENABLE ROW LEVEL SECURITY;

-- Users can read their own credits
CREATE POLICY "Users can read own credits" ON credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credits" ON credits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credits" ON credits FOR UPDATE USING (auth.uid() = user_id);

-- Users can read their own transactions
CREATE POLICY "Users can read own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read and insert their own stripe sessions
CREATE POLICY "Users can read own stripe sessions" ON stripe_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stripe sessions" ON stripe_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stripe sessions" ON stripe_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Grant new users 100 free credits on sign-up (optional: can be triggered by app)
-- This is handled in the app code instead for flexibility

-- =============================================
-- CREDIT PRICING REFERENCE (for documentation)
-- =============================================
-- Token costs (approximate):
--   GPT-4o: ~$5/1M input, ~$15/1M output
--   GPT-3.5-turbo: ~$0.50/1M input, ~$1.50/1M output
--
-- Credit pricing strategy (high margin):
--   1 credit = ~1,000 tokens of AI generation
--   Blog post (~2000 words) = ~50-80 credits
--   Page title = ~5 credits
--   Meta description = ~8 credits
--   AI image = ~25 credits
--   ALT tags batch = ~15 credits
--
-- Packages:
--   Starter:    1,000 credits  = $29   ($0.029/credit)
--   Growth:     5,000 credits  = $79   ($0.016/credit) — 45% savings
--   Agency:    15,000 credits  = $149  ($0.010/credit) — 66% savings
--   Enterprise: 50,000 credits = $399  ($0.008/credit) — 72% savings
-- =============================================
