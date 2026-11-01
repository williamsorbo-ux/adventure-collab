import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  CURRENCIES,
  computeBalances,
  computeDebts,
  computePersonTotals,
  fetchExpenses,
  fetchSettlements,
  formatMoney,
  initials,
  type Participant,
  type Plan,
} from "@/lib/plans";

interface Props {
  plan: Plan;
  participants: Participant[];
  me: Participant | null;
  startOpen?: boolean;
}

export function SplitsTab({ plan, participants, me, startOpen = false }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(startOpen);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", plan.id],
    queryFn: () => fetchExpenses(plan.id),
  });
  const { data: settlements = [] } = useQuery({
    queryKey: ["settlements", plan.id],
    queryFn: () => fetchSettlements(plan.id),
  });

  const totals = useMemo(() => computePersonTotals(expenses), [expenses]);

  const debts = useMemo(
    () => computeDebts(computeBalances(expenses, settlements)),
    [expenses, settlements],
  );

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Okänd";
  const colorOf = (id: string) => participants.find((p) => p.id === id)?.color ?? "#2F5D50";

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["expenses", plan.id] });
    void queryClient.invalidateQueries({ queryKey: ["settlements", plan.id] });
  }

  async function markPaid(fromId: string, toId: string, amount: number, currency: string) {
    const { error } = await supabase.from("settlements").insert({
      plan_id: plan.id,
      from_participant_id: fromId,
      to_participant_id: toId,
      amount,
      currency,
    });
    if (error) {
      toast.error("Kunde inte markera som betald");
      return;
    }
    toast.success("Markerad som betald");
    refresh();
  }

  async function removeExpense(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      toast.error("Kunde inte ta bort utgiften");
      return;
    }
    refresh();
  }

  const myId = me?.id ?? null;
  const currencies = Object.keys(totals);
  const mainCurrency = currencies.includes("SEK") ? "SEK" : (currencies[0] ?? "SEK");
  const balances = computeBalances(expenses, settlements);
  const myNet = myId ? (balances[mainCurrency]?.[myId] ?? 0) : 0;
  const myTotals = myId ? totals[mainCurrency]?.[myId] : undefined;
  const planTotal = expenses
    .filter((e) => e.currency === mainCurrency)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const sortedDebts = [...debts].sort(
    (x, y) => Number(y.from === myId || y.to === myId) - Number(x.from === myId || x.to === myId),
  );
  const heading = "font-display text-2xl font-semibold";
  const card = "rounded-2xl border border-border bg-card";

  return (
    <div className="space-y-6">
      <section aria-label="Ditt saldo" className={`${card} p-5 shadow-lg`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Ditt saldo
        </p>
        {expenses.length === 0 ? (
          <p className="mt-2 font-display text-3xl font-semibold text-primary">Inga utgifter än</p>
        ) : Math.abs(myNet) < 0.5 ? (
          <p className="mt-2 font-display text-5xl font-semibold text-primary">Skuldfri</p>
        ) : (
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className={`font-display text-6xl font-semibold leading-none tracking-tight ${
                myNet > 0 ? "text-primary" : "text-accent-foreground"
              }`}
            >
              {formatMoney(Math.abs(myNet), mainCurrency)}
            </span>
            <span className="text-base text-muted-foreground">
              {myNet > 0 ? "att få" : "att betala"}
            </span>
          </p>
        )}
        {myTotals && (
          <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            <span>Du har lagt ut {formatMoney(myTotals.paid, mainCurrency)}</span>
            <span>Din andel {formatMoney(myTotals.owed, mainCurrency)}</span>
          </p>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              disabled={!me}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-5" /> Lägg till utgift
            </button>
          </DialogTrigger>
          <ExpenseDialog
            plan={plan}
            participants={participants}
            me={me}
            onDone={() => {
              setOpen(false);
              refresh();
            }}
          />
        </Dialog>
      </section>

      <section aria-label="Gör upp">
        <h2 className={`${heading} px-1`}>Gör upp</h2>
        {sortedDebts.length === 0 ? (
          <p className={`${card} mt-2 p-4 text-sm text-muted-foreground`}>
            Allt är jämnt, inga skulder just nu.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {sortedDebts.map((d) => {
              const mine = d.from === myId;
              const toMe = d.to === myId;
              return (
                <li
                  key={`${d.from}-${d.to}-${d.currency}`}
                  className={`${card} space-y-3 p-4 ${mine ? "border-primary" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                      style={{ backgroundColor: colorOf(mine ? d.to : d.from) }}
                    >
                      {initials(nameOf(mine ? d.to : d.from))}
                    </span>
                    <p className="min-w-0 flex-1">
                      {mine ? (
                        <>
                          Du ska Swisha <span className="font-semibold">{nameOf(d.to)}</span>
                        </>
                      ) : toMe ? (
                        <>
                          <span className="font-semibold">{nameOf(d.from)}</span> ska Swisha dig
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{nameOf(d.from)}</span> ska Swisha{" "}
                          {nameOf(d.to)}
                        </>
                      )}
                    </p>
                    <span className="font-display text-xl font-semibold">
                      {formatMoney(d.amount, d.currency)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mine && (
                      <a
                        href={`https://app.swish.nu/1/p/sw/?sw=&amt=${d.amount}&cur=${d.currency}&msg=${encodeURIComponent(plan.title)}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
                      >
                        Öppna Swish
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void markPaid(d.from, d.to, d.amount, d.currency)}
                      className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-border px-4 font-semibold"
                    >
                      <Check className="size-4" /> Markera betald
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {currencies.length > 0 && (
        <section aria-label="Gruppen">
          <h2 className={`${heading} px-1`}>Gruppen</h2>
          {currencies.map((currency) => (
            <ul key={currency} className={`${card} mt-2 divide-y divide-border`}>
              {participants
                .filter((p) => totals[currency]?.[p.id])
                .map((p) => {
                  const t = totals[currency]![p.id]!;
                  const net = balances[currency]?.[p.id] ?? 0;
                  return (
                    <li key={p.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                        style={{ backgroundColor: p.color }}
                      >
                        {initials(p.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {p.name}
                          {p.id === myId && " (du)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Lagt ut {formatMoney(t.paid, currency)} · andel{" "}
                          {formatMoney(t.owed, currency)}
                        </p>
                      </div>
                      <span
                        className={`font-display text-lg font-semibold ${
                          net > 0.5
                            ? "text-primary"
                            : net < -0.5
                              ? "text-accent-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {net > 0.5 ? "+" : ""}
                        {formatMoney(net, currency)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          ))}
        </section>
      )}

      <section aria-label="Utgifter">
        <div className="flex items-baseline justify-between px-1">
          <h2 className={heading}>Utgifter</h2>
          {expenses.length > 0 && (
            <span className="text-sm text-muted-foreground">
              Totalt {formatMoney(planTotal, mainCurrency)}
            </span>
          )}
        </div>
        {expenses.length === 0 ? (
          <p className={`${card} mt-2 p-4 text-sm text-muted-foreground`}>
            Inga utgifter registrerade än.
          </p>
        ) : (
          <ul className={`${card} mt-2 divide-y divide-border`}>
            {expenses.map((e) => (
              <li key={e.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                  style={{ backgroundColor: colorOf(e.payer_id) }}
                >
                  {initials(nameOf(e.payer_id))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {nameOf(e.payer_id)} betalade ·{" "}
                    {e.split_mode === "percent" ? "procentuellt" : "delat lika"} ·{" "}
                    {format(parseISO(e.created_at), "d MMM", { locale: sv })}
                  </p>
                </div>
                <span className="font-display text-xl font-semibold">
                  {formatMoney(Number(e.amount), e.currency)}
                </span>
                <button
                  type="button"
                  aria-label="Ta bort utgift"
                  onClick={() => void removeExpense(e.id)}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                >
                  <Trash2 className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ExpenseDialog({
  plan,
  participants,
  me,
  onDone,
}: Omit<Props, "startOpen"> & { onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SEK");
  const [description, setDescription] = useState("");
  const [payerId, setPayerId] = useState(me?.id ?? participants[0]?.id ?? "");
  const [mode, setMode] = useState<"equal" | "percent">("equal");
  const [included, setIncluded] = useState<string[]>(participants.map((p) => p.id));
  const [percents, setPercents] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const percentTotal = participants.reduce((sum, p) => sum + (Number(percents[p.id]) || 0), 0);

  async function save() {
    const value = Number(amount.replace(",", "."));
    if (!value || !description.trim() || !payerId) return;
    if (mode === "equal" && included.length === 0) return;
    if (mode === "percent" && Math.abs(percentTotal - 100) > 0.5) {
      toast.error("Procentsatserna måste summera till 100 %");
      return;
    }
    setSaving(true);
    try {
      const { data: expense, error } = await supabase
        .from("expenses")
        .insert({
          plan_id: plan.id,
          payer_id: payerId,
          amount: value,
          currency,
          description: description.trim(),
          split_mode: mode,
        })
        .select()
        .single();
      if (error) throw error;

      const rows =
        mode === "equal"
          ? included.map((id) => ({ expense_id: expense.id, participant_id: id, percent: 0 }))
          : participants
              .filter((p) => (Number(percents[p.id]) || 0) > 0)
              .map((p) => ({
                expense_id: expense.id,
                participant_id: p.id,
                percent: Number(percents[p.id]),
              }));

      const { error: shareErr } = await supabase.from("expense_shares").insert(rows);
      if (shareErr) throw shareErr;

      toast.success("Utgift tillagd");
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte spara utgiften");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Lägg till utgift</DialogTitle>
        <DialogDescription>Registrera vad som betalats och hur det ska delas.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="space-y-2">
            <Label htmlFor="amount">Belopp</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1200"
            />
          </div>
          <div className="space-y-2">
            <Label>Valuta</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Beskrivning</Label>
          <Input
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Airbnb, natt 1–3"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label>Vem betalade</Label>
          <Select value={payerId} onValueChange={setPayerId}>
            <SelectTrigger>
              <SelectValue placeholder="Välj person" />
            </SelectTrigger>
            <SelectContent>
              {participants.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Fördelning</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "equal" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("equal")}
            >
              Dela lika
            </Button>
            <Button
              type="button"
              variant={mode === "percent" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("percent")}
            >
              Procentuellt
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-border p-3">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              {mode === "equal" ? (
                <>
                  <Checkbox
                    id={`inc-${p.id}`}
                    checked={included.includes(p.id)}
                    onCheckedChange={(checked) =>
                      setIncluded((prev) =>
                        checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                      )
                    }
                  />
                  <Label htmlFor={`inc-${p.id}`} className="flex-1 font-normal">
                    {p.name}
                  </Label>
                </>
              ) : (
                <>
                  <Label className="flex-1 font-normal">{p.name}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      className="h-8 w-20"
                      inputMode="decimal"
                      value={percents[p.id] ?? ""}
                      onChange={(e) =>
                        setPercents((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      placeholder="0"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </>
              )}
            </div>
          ))}
          {mode === "percent" && (
            <p className="pt-1 text-xs text-muted-foreground">
              Summa: {percentTotal.toFixed(0)} % (måste bli 100 %)
            </p>
          )}
        </div>

        <Button
          variant="hero"
          className="w-full"
          disabled={saving || !amount || !description.trim()}
          onClick={() => void save()}
        >
          Spara utgift
        </Button>
      </div>
    </DialogContent>
  );
}
