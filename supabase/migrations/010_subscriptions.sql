-- Subscription / recurring payment tracking

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  amount numeric NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','semi_annual','annual')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  next_due_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can read subscriptions"
  ON subscriptions FOR SELECT
  USING (family_id = get_my_family_id());

CREATE POLICY "Family members can insert subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (family_id = get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Owner or admin can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (family_id = get_my_family_id() AND (user_id = auth.uid() OR get_my_role() = 'admin'));

CREATE POLICY "Owner or admin can delete subscriptions"
  ON subscriptions FOR DELETE
  USING (family_id = get_my_family_id() AND (user_id = auth.uid() OR get_my_role() = 'admin'));

CREATE INDEX idx_subscriptions_family ON subscriptions(family_id);
CREATE INDEX idx_subscriptions_due ON subscriptions(next_due_date) WHERE is_active = true;
