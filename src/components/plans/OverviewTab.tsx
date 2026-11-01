import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  computeBalances,
  computeDebts,
  computePersonTotals,
  daysUntil,
  fetchExpenses,
  fetchMemories,
  fetchSettlements,
  fetchTodos,
  formatMoney,
  initials,
  signMemoryUrls,
  type Participant,
  type Plan,
  type Todo,
} from "@/lib/plans";

export type PlanTab = "overview" | "splits" | "todos" | "chat" | "memories";

interface Props {
  plan: Plan;
  participants: Participant[];
  meId: string | null;
  onNavigate: (tab: PlanTab, opts?: { newExpense?: boolean }) => void;
}

const card = "rounded-2xl border border-border bg-card";
const heading = "font-display text-2xl font-semibold";

export function OverviewTab({ plan, participants, meId, onNavigate }: Props) {
  const queryClient = useQueryClient();
  const byId = new Map(participants.map((p) => [p.id, p]));

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", plan.id],
    queryFn: () => fetchExpenses(plan.id),
  });
  const { data: settlements = [] } = useQuery({
    queryKey: ["settlements", plan.id],
    queryFn: () => fetchSettlements(plan.id),
  });
  const { data: todos = [] } = useQuery({
    queryKey: ["todos", plan.id],
    queryFn: () => fetchTodos(plan.id),
  });
  const { data: memories = [] } = useQuery({
    queryKey: ["memories", plan.id],
    queryFn: () => fetchMemories(plan.id),
  });

  /* ---- money ---- */
  const balances = computeBalances(expenses, settlements);
  const totals = computePersonTotals(expenses);
  const currencies = Object.keys(totals);
  const currency = currencies.includes("SEK") ? "SEK" : (currencies[0] ?? "SEK");
  const myNet = meId ? (balances[currency]?.[meId] ?? 0) : 0;
  const myTotals = meId ? totals[currency]?.[meId] : undefined;
  const debts = computeDebts(balances).filter((d) => d.currency === currency);
  const owedToMe = debts.filter((d) => d.to === meId);
  const iOwe = debts.filter((d) => d.from === meId);
  const planTotal = expenses
    .filter((e) => e.currency === currency)
    .reduce((s, e) => s + Number(e.amount), 0);
  const settled = Math.abs(myNet) < 0.5;

  /* ---- todos ---- */
  const openTodos = todos.filter((t) => !t.done);
  const doneCount = todos.length - openTodos.length;

  async function toggleTodo(todo: Todo) {
    const { error } = await supabase
      .from("todos")
      .update({ done: true, done_at: new Date().toISOString() })
      .eq("id", todo.id);
    if (error) {
      toast.error("Kunde inte uppdatera uppgiften");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["todos", plan.id] });
  }

  /* ---- photos ---- */
  const [urls, setUrls] = useState<Record<string, string>>({});
  const preview = memories.filter((m) => m.media_type === "image").slice(0, 3);
  useEffect(() => {
    if (preview.length === 0) return;
    let active = true;
    signMemoryUrls(preview.map((m) => m.storage_path))
      .then((map) => active && setUrls(map))
      .catch((err) => console.error(err));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories.length]);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/p/${plan.share_code}` : "";

  return (
    <div className="-mx-4 -mt-6 space-y-5 pb-4">
      {/* compact header */}
      <div className="rounded-b-[2rem] bg-primary px-5 pb-16 pt-5 text-primary-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-semibold leading-tight">{plan.destination}</h2>
            <p className="text-sm opacity-90">
              {participants.length} deltagare
              <CountdownText start={plan.start_date} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              toast.success("Delningslänk kopierad");
            }}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-primary-foreground/15 px-4 text-sm font-semibold"
          >
            <Copy className="size-4" /> Bjud in
          </button>
        </div>
      </div>

      {/* balance card */}
      <section aria-label="Ditt saldo" className={`${card} -mt-14 mx-4 p-5 shadow-lg`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Ditt saldo
        </p>
        {expenses.length === 0 ? (
          <p className="mt-2 font-display text-3xl font-semibold text-primary">Inga utgifter än</p>
        ) : settled ? (
          <p className="mt-2 font-display text-5xl font-semibold text-primary">Skuldfri</p>
        ) : (
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className={`font-display text-6xl font-semibold leading-none tracking-tight ${
                myNet > 0 ? "text-primary" : "text-accent-foreground"
              }`}
            >
              {formatMoney(Math.abs(myNet), currency)}
            </span>
            <span className="text-base text-muted-foreground">
              {myNet > 0 ? "att få" : "att betala"}
            </span>
          </p>
        )}
        {myTotals && (
          <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            <span>Du har lagt ut {formatMoney(myTotals.paid, currency)}</span>
            <span>Din andel {formatMoney(myTotals.owed, currency)}</span>
          </p>
        )}

        {[...owedToMe, ...iOwe].slice(0, 2).map((d) => {
          const other = byId.get(d.to === meId ? d.from : d.to);
          return (
            <div
              key={`${d.from}-${d.to}`}
              className="mt-3 flex items-center gap-3 border-t border-border pt-3"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                style={{ backgroundColor: other?.color ?? "#2F5D50" }}
              >
                {initials(other?.name ?? "?")}
              </span>
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{other?.name ?? "Någon"}</span>{" "}
                {d.to === meId ? "ska Swisha dig " : "ska du Swisha "}
                {formatMoney(d.amount, d.currency)}
              </p>
            </div>
          );
        })}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate("splits", { newExpense: true })}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground"
          >
            <Plus className="size-5" /> Lägg till utgift
          </button>
          <button
            type="button"
            onClick={() => onNavigate("splits")}
            className="min-h-12 rounded-xl border-2 border-border bg-card px-4 text-base font-semibold"
          >
            Gör upp
          </button>
        </div>
      </section>

      {/* recent expenses */}
      {expenses.length > 0 && (
        <section className="mx-4" aria-label="Senaste utgifter">
          <div className="flex items-baseline justify-between px-1">
            <h2 className={heading}>Senaste utgifter</h2>
            <span className="text-sm text-muted-foreground">
              Totalt {formatMoney(planTotal, currency)}
            </span>
          </div>
          <ul className={`${card} mt-2 divide-y divide-border`}>
            {expenses.slice(0, 3).map((e) => {
              const payer = byId.get(e.payer_id);
              return (
                <li key={e.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                    style={{ backgroundColor: payer?.color ?? "#2F5D50" }}
                  >
                    {initials(payer?.name ?? "?")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {payer?.id === meId ? "Du" : (payer?.name ?? "Någon")} betalade · delas på{" "}
                      {e.expense_shares?.length ?? 0}
                    </p>
                  </div>
                  <span className="font-display text-xl font-semibold">
                    {formatMoney(Number(e.amount), e.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* todos */}
      <section aria-label="Att göra" className={`${card} mx-4 px-4 pb-1 pt-4`}>
        <div className="flex items-baseline justify-between">
          <h2 className={heading}>Att göra</h2>
          {todos.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {doneCount} av {todos.length} klara
            </span>
          )}
        </div>
        <ul className="mt-2">
          {openTodos.slice(0, 3).map((t) => (
            <li key={t.id} className="flex min-h-12 items-center gap-3 border-b border-border last:border-0">
              <Checkbox
                id={`ov-${t.id}`}
                className="size-5"
                onCheckedChange={() => void toggleTodo(t)}
              />
              <label htmlFor={`ov-${t.id}`} className="min-w-0 flex-1 truncate">
                {t.title}
              </label>
            </li>
          ))}
          {openTodos.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">
              {todos.length === 0 ? "Inget att göra än." : "Allt är klart!"}
            </li>
          )}
        </ul>
        <button
          type="button"
          onClick={() => onNavigate("todos")}
          className="flex min-h-11 items-center text-sm font-semibold text-primary"
        >
          Visa alla och lägg till
        </button>
      </section>

      {/* photos */}
      <section aria-label="Bilder" className={`${card} mx-4 p-4`}>
        <div className="flex items-baseline justify-between">
          <h2 className={heading}>Bilder</h2>
          <button
            type="button"
            onClick={() => onNavigate("memories")}
            className="min-h-6 text-sm font-semibold text-primary"
          >
            {memories.length > 0 ? "Visa alla" : "Lägg till"}
          </button>
        </div>
        {memories.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Samla gruppens bilder på ett ställe.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {preview.map((m) => (
              <div key={m.id} className="aspect-square overflow-hidden rounded-xl bg-muted">
                {urls[m.storage_path] && (
                  <img
                    src={urls[m.storage_path]}
                    alt={m.caption ?? "Minne från resan"}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </div>
            ))}
            {memories.length > preview.length && (
              <button
                type="button"
                onClick={() => onNavigate("memories")}
                className="flex aspect-square items-center justify-center rounded-xl bg-muted text-sm font-semibold"
              >
                + {memories.length - preview.length}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function CountdownText({ start }: { start: string | null }) {
  const d = daysUntil(start);
  if (d === null) return null;
  if (d > 0) return <> · {d} dagar kvar</>;
  if (d === 0) return <> · idag!</>;
  return <> · genomförd</>;
}
