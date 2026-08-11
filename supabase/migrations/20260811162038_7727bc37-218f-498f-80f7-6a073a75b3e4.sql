CREATE TABLE public.todos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO authenticated;
GRANT ALL ON public.todos TO service_role;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read todos" ON public.todos FOR SELECT USING (true);
CREATE POLICY "Anyone can add todos" ON public.todos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update todos" ON public.todos FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete todos" ON public.todos FOR DELETE USING (true);
CREATE TRIGGER todos_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.todo_assignees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  todo_id uuid NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (todo_id, participant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_assignees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todo_assignees TO authenticated;
GRANT ALL ON public.todo_assignees TO service_role;
ALTER TABLE public.todo_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read todo assignees" ON public.todo_assignees FOR SELECT USING (true);
CREATE POLICY "Anyone can add todo assignees" ON public.todo_assignees FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete todo assignees" ON public.todo_assignees FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.todo_assignees;