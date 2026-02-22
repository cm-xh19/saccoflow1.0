-- =========================================================================
-- SaccoFlow Multi-Tenant Backend Schema & Policies
-- STRICT ISOLATION BY sacco_id
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- CUSTOM TYPES (ENUMS)
-- =========================================================================
CREATE TYPE user_role AS ENUM ('saccoflow_admin', 'sacco_admin', 'member');
CREATE TYPE sacco_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE member_status AS ENUM ('Active', 'Inactive');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal');
CREATE TYPE loan_status AS ENUM ('pending', 'approved', 'rejected', 'active', 'completed');

-- =========================================================================
-- TABLES
-- =========================================================================

-- 1) saccos
CREATE TABLE saccos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    location TEXT,
    registration_number TEXT,
    nin TEXT,
    status sacco_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) profiles
-- Every user must have a profile. saccoflow_admin has sacco_id = NULL.
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    sacco_id UUID REFERENCES saccos(id) ON DELETE CASCADE NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role user_role NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) members
CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacco_id UUID NOT NULL REFERENCES saccos(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    nin TEXT,
    status member_status DEFAULT 'Active',
    date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sacco_id, profile_id),
    UNIQUE(sacco_id, email)
);

-- 4) transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacco_id UUID NOT NULL REFERENCES saccos(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    note TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) loans
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacco_id UUID NOT NULL REFERENCES saccos(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    interest_rate NUMERIC,
    status loan_status DEFAULT 'pending',
    purpose TEXT NOT NULL,
    repayment_term_months INTEGER,
    repayment_date DATE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) loan_applications (Full form support)
CREATE TABLE loan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacco_id UUID NOT NULL REFERENCES saccos(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT,
    nationality TEXT,
    marital_status TEXT,
    physical_address TEXT,
    email TEXT,
    phone TEXT,
    emergency_contact TEXT,
    employment_details TEXT,
    income_details TEXT,
    desired_amount NUMERIC NOT NULL CHECK (desired_amount > 0),
    purpose TEXT NOT NULL,
    repayment_term_months INTEGER,
    repayment_date DATE NOT NULL,
    status loan_status DEFAULT 'pending',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reviewed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7) loan_repayments
CREATE TABLE loan_repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8) notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacco_id UUID NOT NULL REFERENCES saccos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9) audit_logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sacco_id UUID NOT NULL REFERENCES saccos(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT,
    performed_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================================================
-- INDEXES
-- =========================================================================
CREATE INDEX idx_profiles_sacco_id ON profiles(sacco_id);
CREATE INDEX idx_members_sacco_id ON members(sacco_id);
CREATE INDEX idx_transactions_sacco_id ON transactions(sacco_id);
CREATE INDEX idx_loans_sacco_id ON loans(sacco_id);
CREATE INDEX idx_loan_apps_sacco_id ON loan_applications(sacco_id);
CREATE INDEX idx_notifications_sacco_id ON notifications(sacco_id);
CREATE INDEX idx_audit_logs_sacco_id ON audit_logs(sacco_id);

CREATE INDEX idx_transactions_member_id ON transactions(member_id);
CREATE INDEX idx_loans_member_id ON loans(member_id);
CREATE INDEX idx_loan_apps_member_id ON loan_applications(member_id);

-- =========================================================================
-- UPDATED_AT TRIGGERS
-- =========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saccos_updated_at BEFORE UPDATE ON saccos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_loan_apps_updated_at BEFORE UPDATE ON loan_applications FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- =========================================================================
-- AUTH TRIGGER: AUTO-CREATE PROFILE
-- =========================================================================
-- Note: 'role' and 'sacco_id' can optionally be passed in raw_user_meta_data
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role := 'member';
  _sacco_id UUID := NULL;
  _full_name TEXT := 'Unknown';
BEGIN
  -- Safely extract full_name
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data->>'full_name' IS NOT NULL AND NEW.raw_user_meta_data->>'full_name' != '' THEN
    _full_name := NEW.raw_user_meta_data->>'full_name';
  END IF;

  -- Safely extract role (defaults to 'member' if missing or invalid)
  BEGIN
    IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data->>'role' IS NOT NULL AND NEW.raw_user_meta_data->>'role' != '' THEN
      _role := (NEW.raw_user_meta_data->>'role')::user_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _role := 'member';
  END;

  -- Safely extract sacco_id (defaults to NULL if missing or invalid)
  BEGIN
    IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data->>'sacco_id' IS NOT NULL AND NEW.raw_user_meta_data->>'sacco_id' != '' THEN
      _sacco_id := (NEW.raw_user_meta_data->>'sacco_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _sacco_id := NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, role, sacco_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    _full_name,
    _role,
    _sacco_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


-- =========================================================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================================================
ALTER TABLE saccos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION is_saccoflow_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'saccoflow_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_sacco_id() RETURNS UUID AS $$
  SELECT sacco_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Saccos
CREATE POLICY "Saccoflow admins can do everything on saccos" ON saccos FOR ALL USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins and members can view their own sacco" ON saccos FOR SELECT USING (id = current_sacco_id());

-- Profiles
CREATE POLICY "Saccoflow admins can manage all profiles" ON profiles FOR ALL USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can manage profiles in their sacco" ON profiles FOR ALL USING (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
CREATE POLICY "Members can view their own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Members can update their own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Members
CREATE POLICY "Saccoflow admins can manage all members" ON members FOR ALL USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can manage members in their sacco" ON members FOR ALL USING (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
CREATE POLICY "Members can view their own member record" ON members FOR SELECT USING (profile_id = auth.uid());

-- Transactions
CREATE POLICY "Saccoflow admins can view all transactions" ON transactions FOR SELECT USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can manage transactions in their sacco" ON transactions FOR ALL USING (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
CREATE POLICY "Members can view their own transactions" ON transactions FOR SELECT USING (
  member_id = (SELECT id FROM members WHERE profile_id = auth.uid())
);

-- Loans
CREATE POLICY "Saccoflow admins can view all loans" ON loans FOR SELECT USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can manage loans in their sacco" ON loans FOR ALL USING (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
CREATE POLICY "Members can view their own loans" ON loans FOR SELECT USING (
  member_id = (SELECT id FROM members WHERE profile_id = auth.uid())
);

-- Loan Applications
CREATE POLICY "Saccoflow admins can view all loan apps" ON loan_applications FOR SELECT USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can manage loan apps in their sacco" ON loan_applications FOR ALL USING (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
CREATE POLICY "Members can view their own loan apps" ON loan_applications FOR SELECT USING (
  member_id = (SELECT id FROM members WHERE profile_id = auth.uid())
);
CREATE POLICY "Members can insert their own loan apps" ON loan_applications FOR INSERT WITH CHECK (
  member_id = (SELECT id FROM members WHERE profile_id = auth.uid()) AND status = 'pending'
);

-- Loan Repayments
CREATE POLICY "Saccoflow admins can view all repayments" ON loan_repayments FOR SELECT USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can manage repayments in their sacco" ON loan_repayments FOR ALL USING (
  (SELECT sacco_id FROM loans WHERE loans.id = loan_repayments.loan_id) = current_sacco_id() AND current_user_role() = 'sacco_admin'
);
CREATE POLICY "Members can view their own repayments" ON loan_repayments FOR SELECT USING (
  (SELECT member_id FROM loans WHERE loans.id = loan_repayments.loan_id) = (SELECT id FROM members WHERE profile_id = auth.uid())
);

-- Notifications
CREATE POLICY "Saccoflow admins can view all notifications" ON notifications FOR SELECT USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can manage notifications in their sacco" ON notifications FOR ALL USING (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
CREATE POLICY "Members can view their sacco's notifications" ON notifications FOR SELECT USING (sacco_id = current_sacco_id());

-- Audit Logs
CREATE POLICY "Saccoflow admins can view all audit logs" ON audit_logs FOR SELECT USING (is_saccoflow_admin());
CREATE POLICY "Sacco admins can view audit logs for their sacco" ON audit_logs FOR SELECT USING (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
CREATE POLICY "Sacco admins can create audit logs" ON audit_logs FOR INSERT WITH CHECK (sacco_id = current_sacco_id() AND current_user_role() = 'sacco_admin');
