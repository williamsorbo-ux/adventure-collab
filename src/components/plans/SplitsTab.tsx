import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { ArrowRight, Check, Plus, Receipt, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import {
  CURRENCIES,
  computeBalances,
  computeDebts,
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
}

export function SplitsTab({ plan, participants, me }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", plan.id],
    queryFn: () => fetchExpenses(plan.id),
  });
  const { data: settlements = [] } = useQuery({
    queryKey: ["settlements", plan.id],
    queryFn: () => fetchSettlements(plan.id),
  });

  const debts = useMemo(
    () => computeDebts(computeBalances(expenses, settlements)),
    [expenses, settlements],
  );

  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? "Okänd";
  const colorOf = (id: string) => participants.find((p) => p.id === id)?.color ?? "#3366cc";

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

  return (
    <div className="space-y-6">
      <section className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">Vem är skyldig vem</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" size="sm" disabled={!me}>
                <Plus /> Ny utgift
              </Button>
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
        </div>

        {debts.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Allt är jämnt – inga skulder just nu.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {debts.map((d) => (
              <li
                key={`${d.from}-${d.to}-${d.currency}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/50 p-3"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
                    style={{ backgroundColor: colorOf(d.from) }}
                  >
                    {initials(nameOf(d.from))}
                  </span>
                  {nameOf(d.from)}
                  <ArrowRight className="size-4 text-muted-foreground" />
                  {nameOf(d.to)}
                </span>
                <Badge className="ml-auto text-sm">{formatMoney(d.amount, d.currency)}</Badge>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://app.revolut.com/`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Revolut
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://app.swish.nu/1/p/sw/?sw=&amt=${d.amount}&cur=${d.currency}&msg=${encodeURIComponent(plan.title)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Swish
                    </a>
                  </Button>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => void markPaid(d.from, d.to, d.amount, d.currency)}
                  >
                    <Check /> Betald
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-surface p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Receipt className="size-4 text-accent" /> Utgifter
        </h2>
        {expenses.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Inga utgifter registrerade än.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {nameOf(e.payer_id)} betalade ·{" "}
                    {e.split_mode === "percent" ? "procentuellt" : "delat lika"} ·{" "}
                    {format(parseISO(e.created_at), "d MMM", { locale: sv })}
                  </p>
                </div>
                <span className="font-display font-semibold">
                  {formatMoney(Number(e.amount), e.currency)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ta bort utgift"
                  onClick={() => void removeExpense(e.id)}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
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
}: Props & { onDone: () => void }) {
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
