-- Create this file as: supabase/migrations/[timestamp]_user_credits_system.sql
-- Example: supabase/migrations/20240115000000_user_credits_system.sql

-- ============================================
-- USER MANAGEMENT & CREDITS SYSTEM MIGRATION
-- ============================================

-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Company Information
  name TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  industry TEXT,
  
  -- Address Information
  street_address TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'GB',
  
  -- Contact Information
  main_contact_name TEXT,
  main_contact_email TEXT,
  main_contact_phone TEXT,
  billing_email TEXT,
  
  -- Account Status
  account_type TEXT DEFAULT 'trial', -- trial, paid, enterprise
  subscription_status TEXT DEFAULT 'active', -- active, paused, cancelled, expired
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  
  -- Settings
  max_users INTEGER DEFAULT 5, -- Limit users per company
  settings JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Check if profiles table exists and add new columns
DO $$ 
BEGIN
  -- Create profiles table if it doesn't exist
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    CREATE TABLE profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
  
  -- Add new columns if they don't exist
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'company_id') THEN
    ALTER TABLE profiles ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE profiles ADD COLUMN full_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
    ALTER TABLE profiles ADD CONSTRAINT valid_role CHECK (role IN ('super_admin', 'company_admin', 'user'));
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'permissions') THEN
    ALTER TABLE profiles ADD COLUMN permissions JSONB DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'preferences') THEN
    ALTER TABLE profiles ADD COLUMN preferences JSONB DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_login_at') THEN
    ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3. CREDITS BALANCE TABLE
CREATE TABLE IF NOT EXISTS credits_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Current Balance
  current_balance DECIMAL(10,2) DEFAULT 0,
  total_purchased DECIMAL(10,2) DEFAULT 0,
  total_consumed DECIMAL(10,2) DEFAULT 0,
  
  -- Expiry Tracking
  balance_expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREDIT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Transaction Details
  type TEXT NOT NULL, -- purchase, consumption, adjustment, expiry, refund
  amount DECIMAL(10,2) NOT NULL, -- positive for credits in, negative for credits out
  balance_after DECIMAL(10,2) NOT NULL,
  
  -- Transaction Metadata
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Store details like file size, AI model used, etc.
  
  -- Reference to what consumed credits
  reference_type TEXT, -- video_upload, image_upload, ai_inference, manual_adjustment
  reference_id UUID, -- ID of the video, image, or observation
  
  -- Who performed the action
  user_id UUID REFERENCES profiles(id),
  
  -- Payment Reference (if applicable)
  payment_reference TEXT, -- Stripe payment ID, invoice number, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- When these credits expire (for purchases)
  
  CONSTRAINT valid_transaction_type CHECK (type IN ('purchase', 'consumption', 'adjustment', 'expiry', 'refund'))
);

-- 5. CREDIT PRICING RULES TABLE
CREATE TABLE IF NOT EXISTS credit_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule Definition
  operation_type TEXT NOT NULL, -- video_upload, image_upload, ai_inference
  unit_type TEXT NOT NULL, -- mb, gb, count, seconds
  credits_per_unit DECIMAL(10,4) NOT NULL,
  
  -- Optional Constraints
  min_charge DECIMAL(10,2) DEFAULT 0,
  max_charge DECIMAL(10,2),
  
  -- Rule Applicability
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Description
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for active rules
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_active_rule') THEN
    ALTER TABLE credit_pricing_rules ADD CONSTRAINT unique_active_rule 
      UNIQUE (operation_type, is_active) WHERE (is_active = true);
  END IF;
END $$;

-- 6. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Subscription Details
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL, -- trial, starter, professional, enterprise
  credits_included DECIMAL(10,2) NOT NULL,
  price_amount DECIMAL(10,2),
  price_currency TEXT DEFAULT 'GBP',
  
  -- Period
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'active', -- active, cancelled, expired
  cancelled_at TIMESTAMPTZ,
  
  -- Payment
  payment_method TEXT, -- stripe, manual, trial
  payment_reference TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who did what
  user_id UUID REFERENCES profiles(id),
  company_id UUID REFERENCES companies(id),
  action TEXT NOT NULL,
  
  -- What was affected
  resource_type TEXT,
  resource_id UUID,
  
  -- Details
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_company_id ON credit_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DO $$ 
BEGIN
  -- Companies Policies
  DROP POLICY IF EXISTS "Super admins can manage all companies" ON companies;
  DROP POLICY IF EXISTS "Company admins can view and update their company" ON companies;
  DROP POLICY IF EXISTS "Users can view their company" ON companies;
  
  -- Profiles Policies
  DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
  DROP POLICY IF EXISTS "Company admins can manage company users" ON profiles;
  DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
  
  -- Credits Balance Policies
  DROP POLICY IF EXISTS "Company users can view their credit balance" ON credits_balance;
  DROP POLICY IF EXISTS "Only super admins can modify credit balances" ON credits_balance;
  
  -- Credit Transactions Policies
  DROP POLICY IF EXISTS "Company users can view their credit transactions" ON credit_transactions;
  DROP POLICY IF EXISTS "System can create credit transactions" ON credit_transactions;
  
  -- Credit Pricing Rules Policies
  DROP POLICY IF EXISTS "Anyone can view active pricing rules" ON credit_pricing_rules;
  DROP POLICY IF EXISTS "Super admins can manage pricing rules" ON credit_pricing_rules;
END $$;

-- Companies Policies
CREATE POLICY "Super admins can manage all companies" ON companies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

CREATE POLICY "Company admins can view and update their company" ON companies
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.company_id = companies.id
      AND profiles.role = 'company_admin'
    )
  );

CREATE POLICY "Users can view their company" ON companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.company_id = companies.id
    )
  );

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Company admins can manage company users" ON profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role = 'company_admin'
      AND p.company_id = profiles.company_id
    )
  );

CREATE POLICY "Super admins can manage all profiles" ON profiles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- Credits Balance Policies
CREATE POLICY "Company users can view their credit balance" ON credits_balance
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Only super admins can modify credit balances" ON credits_balance
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- Credit Transactions Policies
CREATE POLICY "Company users can view their credit transactions" ON credit_transactions
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can create credit transactions" ON credit_transactions
  FOR INSERT TO authenticated
  WITH CHECK (true); -- We'll handle validation in functions

-- Credit Pricing Rules - Everyone can read, only super admins can modify
CREATE POLICY "Anyone can view active pricing rules" ON credit_pricing_rules
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins can manage pricing rules" ON credit_pricing_rules
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'));

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create a new company with initial setup
CREATE OR REPLACE FUNCTION create_company_with_trial(
  company_name TEXT,
  admin_email TEXT,
  admin_name TEXT,
  trial_credits DECIMAL DEFAULT 100
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_company_id UUID;
  new_user_id UUID;
BEGIN
  -- Create company
  INSERT INTO companies (name, account_type, trial_ends_at)
  VALUES (company_name, 'trial', NOW() + INTERVAL '30 days')
  RETURNING id INTO new_company_id;
  
  -- Create initial credit balance
  INSERT INTO credits_balance (company_id, current_balance)
  VALUES (new_company_id, trial_credits);
  
  -- Log the trial credit allocation
  INSERT INTO credit_transactions (
    company_id, type, amount, balance_after, 
    description, reference_type
  )
  VALUES (
    new_company_id, 'purchase', trial_credits, trial_credits,
    'Trial credits', 'trial_signup'
  );
  
  RETURN new_company_id;
END;
$$;

-- Function to consume credits
CREATE OR REPLACE FUNCTION consume_credits(
  p_company_id UUID,
  p_amount DECIMAL,
  p_description TEXT,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_user_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance_amount DECIMAL;
  new_balance DECIMAL;
BEGIN
  -- Get current balance with lock
  SELECT current_balance INTO current_balance_amount
  FROM credits_balance
  WHERE company_id = p_company_id
  FOR UPDATE;
  
  -- Check if sufficient credits
  IF current_balance_amount < p_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate new balance
  new_balance := current_balance_amount - p_amount;
  
  -- Update balance
  UPDATE credits_balance
  SET current_balance = new_balance,
      total_consumed = total_consumed + p_amount,
      updated_at = NOW()
  WHERE company_id = p_company_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (
    company_id, type, amount, balance_after,
    description, reference_type, reference_id,
    user_id, metadata
  )
  VALUES (
    p_company_id, 'consumption', -p_amount, new_balance,
    p_description, p_reference_type, p_reference_id,
    p_user_id, p_metadata
  );
  
  RETURN TRUE;
END;
$$;

-- Function to add credits (for super admin)
CREATE OR REPLACE FUNCTION add_credits(
  p_company_id UUID,
  p_amount DECIMAL,
  p_description TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance_amount DECIMAL;
  new_balance DECIMAL;
BEGIN
  -- Get current balance
  SELECT current_balance INTO current_balance_amount
  FROM credits_balance
  WHERE company_id = p_company_id;
  
  -- Calculate new balance
  new_balance := current_balance_amount + p_amount;
  
  -- Update balance
  UPDATE credits_balance
  SET current_balance = new_balance,
      total_purchased = total_purchased + p_amount,
      updated_at = NOW()
  WHERE company_id = p_company_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (
    company_id, type, amount, balance_after,
    description, payment_reference, expires_at
  )
  VALUES (
    p_company_id, 'purchase', p_amount, new_balance,
    p_description, p_payment_reference, p_expires_at
  );
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_credits_balance_updated_at ON credits_balance;

-- Create triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credits_balance_updated_at BEFORE UPDATE ON credits_balance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL CREDIT PRICING RULES
-- ============================================

-- Only insert if table is empty
INSERT INTO credit_pricing_rules (operation_type, unit_type, credits_per_unit, description) 
SELECT * FROM (VALUES
  ('video_upload', 'mb', 0.1, 'Video upload - 0.1 credits per MB'),
  ('image_upload', 'mb', 0.05, 'Image upload - 0.05 credits per MB'),
  ('ai_inference', 'count', 5, 'AI inference - 5 credits per analysis')
) AS v(operation_type, unit_type, credits_per_unit, description)
WHERE NOT EXISTS (SELECT 1 FROM credit_pricing_rules);

-- ============================================
-- VIEWS FOR EASIER QUERYING
-- ============================================

-- Drop view if exists and recreate
DROP VIEW IF EXISTS company_dashboard;

CREATE VIEW company_dashboard AS
SELECT 
  c.*,
  cb.current_balance,
  cb.total_purchased,
  cb.total_consumed,
  (SELECT COUNT(*) FROM profiles p WHERE p.company_id = c.id) as user_count,
  (SELECT COUNT(*) FROM projects pr WHERE pr.user_id IN (SELECT id FROM profiles WHERE company_id = c.id)) as project_count
FROM companies c
LEFT JOIN credits_balance cb ON cb.company_id = c.id;

-- ============================================
-- PROFILE CREATION TRIGGER
-- ============================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();