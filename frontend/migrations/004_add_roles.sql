-- =============================================
-- ADD ROLE SYSTEM TO PROFILES
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bvbxyrgqdjctnbyilzjj/sql/new
-- =============================================

-- Step 1: Add role column to profiles (default = 'user')
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Step 2: Set tim@scalz.ai as admin (the platform owner)
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'tim@scalz.ai';

-- Step 3: Update the trigger function so new signups always get role = 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile with 'user' role
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'user')
    ON CONFLICT (id) DO NOTHING;

    -- Give 100 free credits
    INSERT INTO public.credits (user_id, balance, lifetime_purchased, lifetime_used)
    VALUES (NEW.id, 100, 100, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Log the welcome bonus transaction
    INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description)
    VALUES (NEW.id, 'bonus', 100, 100, 'Welcome bonus — 100 free credits');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Verify — check all profiles and their roles
SELECT id, email, role, created_at FROM public.profiles ORDER BY created_at;
