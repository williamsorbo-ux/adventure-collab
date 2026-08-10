CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code text NOT NULL UNIQUE,
  plan_type text NOT NULL,
  subcategory text,
  title text NOT NULL,
  destination text NOT NULL,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.plans TO anon;
GRANT SELECT, INSERT, UPDATE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone with the link can read plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Anyone can create plans" ON public.plans FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update plans" ON public.plans FOR UPDATE USING (true) WITH CHECK (true);
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3366cc',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX participants_plan_id_idx ON public.participants(plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join as participant" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update participants" ON public.participants FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can remove participants" ON public.participants FOR DELETE USING (true);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_plan_id_idx ON public.messages(plan_id, created_at);
GRANT SELECT, INSERT ON public.messages TO anon;
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can post messages" ON public.messages FOR INSERT WITH CHECK (true);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'SEK',
  description text NOT NULL,
  split_mode text NOT NULL DEFAULT 'equal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_plan_id_idx ON public.expenses(plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Anyone can add expenses" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update expenses" ON public.expenses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete expenses" ON public.expenses FOR DELETE USING (true);
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.expense_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  percent numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, participant_id)
);
CREATE INDEX expense_shares_expense_id_idx ON public.expense_shares(expense_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_shares TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_shares TO authenticated;
GRANT ALL ON public.expense_shares TO service_role;
ALTER TABLE public.expense_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read expense shares" ON public.expense_shares FOR SELECT USING (true);
CREATE POLICY "Anyone can add expense shares" ON public.expense_shares FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update expense shares" ON public.expense_shares FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete expense shares" ON public.expense_shares FOR DELETE USING (true);

CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  from_participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  to_participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'SEK',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX settlements_plan_id_idx ON public.settlements(plan_id);
GRANT SELECT, INSERT, DELETE ON public.settlements TO anon;
GRANT SELECT, INSERT, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read settlements" ON public.settlements FOR SELECT USING (true);
CREATE POLICY "Anyone can add settlements" ON public.settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete settlements" ON public.settlements FOR DELETE USING (true);

CREATE TABLE public.memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  uploader_name text NOT NULL,
  storage_path text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX memories_plan_id_idx ON public.memories(plan_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.memories TO anon;
GRANT SELECT, INSERT, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read memories" ON public.memories FOR SELECT USING (true);
CREATE POLICY "Anyone can add memories" ON public.memories FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete memories" ON public.memories FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;