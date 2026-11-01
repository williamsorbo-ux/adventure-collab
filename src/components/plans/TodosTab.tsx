import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ListChecks, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { fetchTodos, initials, type Participant, type Plan, type Todo } from "@/lib/plans";

interface Props {
  plan: Plan;
  participants: Participant[];
  me: Participant | null;
}

export function TodosTab({ plan, participants, me }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: todos = [] } = useQuery({
    queryKey: ["todos", plan.id],
    queryFn: () => fetchTodos(plan.id),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["todos", plan.id] });

  useEffect(() => {
    const channel = supabase
      .channel(`todos-${plan.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "todos" }, () => {
        void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "todo_assignees" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Okänd";
  const colorOf = (id: string) => participants.find((p) => p.id === id)?.color ?? "#2F5D50";

  async function addTodo() {
    if (title.trim().length < 2) return;
    setSaving(true);
    try {
      const { data: todo, error } = await supabase
        .from("todos")
        .insert({ plan_id: plan.id, title: title.trim(), created_by_name: me?.name ?? null })
        .select()
        .single();
      if (error) throw error;
      if (assignees.length > 0) {
        const { error: aErr } = await supabase
          .from("todo_assignees")
          .insert(assignees.map((id) => ({ todo_id: todo.id, participant_id: id })));
        if (aErr) throw aErr;
      }
      setTitle("");
      setAssignees([]);
      void refresh();
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte spara uppgiften");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(todo: Todo) {
    const { error } = await supabase
      .from("todos")
      .update({ done: !todo.done, done_at: todo.done ? null : new Date().toISOString() })
      .eq("id", todo.id);
    if (error) {
      toast.error("Kunde inte uppdatera uppgiften");
      return;
    }
    void refresh();
  }

  async function toggleAssignee(todo: Todo, participantId: string) {
    const existing = todo.todo_assignees?.find((a) => a.participant_id === participantId);
    if (existing) {
      await supabase.from("todo_assignees").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("todo_assignees")
        .insert({ todo_id: todo.id, participant_id: participantId });
    }
    void refresh();
  }

  async function removeTodo(id: string) {
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      toast.error("Kunde inte ta bort uppgiften");
      return;
    }
    void refresh();
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div className="space-y-6">
      <section className="card-surface p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <ListChecks className="size-4 text-accent" /> Ny uppgift
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="T.ex. Köp kol till grillen"
            maxLength={140}
            className="min-w-[12rem] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") void addTodo();
            }}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="soft">
                <Users /> Tilldela{assignees.length > 0 ? ` (${assignees.length})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 space-y-2">
              {participants.length === 0 && (
                <p className="text-sm text-muted-foreground">Inga deltagare än.</p>
              )}
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`new-a-${p.id}`}
                    checked={assignees.includes(p.id)}
                    onCheckedChange={(checked) =>
                      setAssignees((prev) =>
                        checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                      )
                    }
                  />
                  <Label htmlFor={`new-a-${p.id}`} className="font-normal">
                    {p.name}
                  </Label>
                </div>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="hero" disabled={saving || title.trim().length < 2} onClick={() => void addTodo()}>
            <Plus /> Lägg till
          </Button>
        </div>
      </section>

      <section className="card-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Att göra</h2>
          <Badge variant="secondary">
            {done.length}/{todos.length} klara
          </Badge>
        </div>

        {todos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Inga uppgifter än – lägg till det första ni måste fixa.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {[...open, ...done].map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <Checkbox
                  id={`todo-${t.id}`}
                  checked={t.done}
                  onCheckedChange={() => void toggleDone(t)}
                />
                <Label
                  htmlFor={`todo-${t.id}`}
                  className={`min-w-0 flex-1 font-normal ${t.done ? "text-muted-foreground line-through" : ""}`}
                >
                  {t.title}
                </Label>

                <div className="flex items-center gap-1">
                  {(t.todo_assignees ?? []).map((a) => (
                    <span
                      key={a.id}
                      title={nameOf(a.participant_id)}
                      className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
                      style={{ backgroundColor: colorOf(a.participant_id) }}
                    >
                      {initials(nameOf(a.participant_id))}
                    </span>
                  ))}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Tilldela deltagare">
                        <Users className="text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 space-y-2">
                      {participants.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`a-${t.id}-${p.id}`}
                            checked={!!t.todo_assignees?.some((a) => a.participant_id === p.id)}
                            onCheckedChange={() => void toggleAssignee(t, p.id)}
                          />
                          <Label htmlFor={`a-${t.id}-${p.id}`} className="font-normal">
                            {p.name}
                          </Label>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Ta bort uppgift"
                    onClick={() => void removeTodo(t.id)}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {todos.length > 0 && open.length === 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-accent">
            <CheckCircle2 className="size-4" /> Allt är avbockat – ni är klara!
          </p>
        )}
      </section>
    </div>
  );
}
