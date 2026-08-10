import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { fetchMessages, initials, type Participant, type Plan } from "@/lib/plans";

interface Props {
  plan: Plan;
  participants: Participant[];
  me: Participant | null;
}

export function ChatTab({ plan, participants, me }: Props) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", plan.id],
    queryFn: () => fetchMessages(plan.id),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${plan.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `plan_id=eq.${plan.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["messages", plan.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [plan.id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || !me) return;
    setSending(true);
    setDraft("");
    const { error } = await supabase.from("messages").insert({
      plan_id: plan.id,
      participant_id: me.id,
      author_name: me.name,
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Meddelandet kunde inte skickas");
      setDraft(body);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["messages", plan.id] });
  }

  const colorOf = (participantId: string | null) =>
    participants.find((p) => p.id === participantId)?.color ?? "#3366cc";

  return (
    <div className="card-surface flex h-[60vh] min-h-[420px] flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Inga meddelanden än. Säg hej till gänget!
          </p>
        )}
        {messages.map((m) => {
          const mine = me && m.participant_id === me.id;
          return (
            <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              <span
                className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
                style={{ backgroundColor: colorOf(m.participant_id) }}
              >
                {initials(m.author_name)}
              </span>
              <div className={cn("max-w-[75%]", mine && "text-right")}>
                <p className="text-[11px] text-muted-foreground">
                  {m.author_name} · {format(parseISO(m.created_at), "HH:mm", { locale: sv })}
                </p>
                <p
                  className={cn(
                    "mt-0.5 inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {m.body}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-border bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Skriv ett meddelande…"
          maxLength={800}
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
