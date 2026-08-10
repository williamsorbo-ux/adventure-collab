import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, ArrowRight, CalendarIcon, Loader2, MapPin, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  PARTICIPANT_COLORS,
  PLAN_TYPES,
  TRIP_SUBCATEGORIES,
  makeShareCode,
  rememberPlan,
  setGuest,
} from "@/lib/plans";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlanWizard({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [planType, setPlanType] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [title, setTitle] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const steps = planType === "resa" ? ["Typ", "Kategori", "Destination", "Datum"] : ["Typ", "Destination", "Datum"];
  const stepKey = planType === "resa" ? ["type", "sub", "place", "dates"][step] : ["type", "place", "dates"][step];

  const canNext =
    stepKey === "type"
      ? !!planType
      : stepKey === "sub"
        ? !!subcategory
        : stepKey === "place"
          ? destination.trim().length > 1
          : !!range?.from && name.trim().length > 1;

  function reset() {
    setStep(0);
    setPlanType(null);
    setSubcategory(null);
    setDestination("");
    setTitle("");
    setRange(undefined);
    setName("");
  }

  async function createPlan() {
    if (!range?.from) return;
    setSaving(true);
    try {
      const code = makeShareCode();
      const fallbackTitle =
        title.trim() ||
        `${TRIP_SUBCATEGORIES.find((s) => s.id === subcategory)?.label ?? PLAN_TYPES.find((t) => t.id === planType)?.label ?? "Plan"} – ${destination.trim()}`;

      const { data: plan, error } = await supabase
        .from("plans")
        .insert({
          share_code: code,
          plan_type: planType!,
          subcategory,
          title: fallbackTitle,
          destination: destination.trim(),
          start_date: format(range.from, "yyyy-MM-dd"),
          end_date: format(range.to ?? range.from, "yyyy-MM-dd"),
        })
        .select()
        .single();
      if (error) throw error;

      const { data: participant, error: pErr } = await supabase
        .from("participants")
        .insert({ plan_id: plan.id, name: name.trim(), color: PARTICIPANT_COLORS[0]! })
        .select()
        .single();
      if (pErr) throw pErr;

      setGuest(plan.id, { participantId: participant.id, name: participant.name });
      rememberPlan({
        code,
        title: plan.title,
        destination: plan.destination,
        start_date: plan.start_date,
      });
      onOpenChange(false);
      reset();
      navigate({ to: "/p/$code", params: { code } });
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte skapa planen. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="bg-gradient-primary px-6 pb-5 pt-6 text-primary-foreground">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-4" /> Skapa ny Plan
          </DialogTitle>
          <p className="mt-1 text-sm opacity-90">Fyra snabba steg – sen kan du dela länken.</p>
          <div className="mt-4 flex gap-1.5">
            {steps.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all",
                  i <= step ? "bg-primary-foreground" : "bg-primary-foreground/30",
                )}
              />
            ))}
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          {stepKey === "type" && (
            <div className="grid grid-cols-2 gap-3">
              {PLAN_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setPlanType(t.id);
                    if (t.id !== "resa") setSubcategory(null);
                    setStep(1);
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all hover:border-primary hover:shadow-card",
                    planType === t.id ? "border-primary bg-primary-soft" : "border-border bg-card",
                  )}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <p className="mt-2 font-display font-semibold">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.hint}</p>
                </button>
              ))}
            </div>
          )}

          {stepKey === "sub" && (
            <div className="grid gap-2">
              {TRIP_SUBCATEGORIES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSubcategory(s.id);
                    setStep(2);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:border-primary",
                    subcategory === s.id ? "border-primary bg-primary-soft" : "border-border bg-card",
                  )}
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span className="font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {stepKey === "place" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="destination">Destination</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent" />
                  <Input
                    id="destination"
                    autoFocus
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="t.ex. Prag, Tjeckien"
                    className="pl-9"
                    maxLength={80}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Namn på planen (valfritt)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Svensexa Prag 2026"
                  maxLength={80}
                />
              </div>
            </div>
          )}

          {stepKey === "dates" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Datum</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      <CalendarIcon />
                      {range?.from
                        ? `${format(range.from, "d MMM", { locale: sv })} – ${
                            range.to ? format(range.to, "d MMM yyyy", { locale: sv }) : "…"
                          }`
                        : "Välj start- och slutdatum"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={range}
                      onSelect={setRange}
                      numberOfMonths={1}
                      locale={sv}
                      className={cn("pointer-events-auto p-3")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Ditt namn</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Anna"
                    className="pl-9"
                    maxLength={40}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ingen inloggning krävs – dina kompisar går med via namn och delningslänk.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
            >
              <ArrowLeft /> Tillbaka
            </Button>
            {stepKey === "dates" ? (
              <Button variant="hero" onClick={createPlan} disabled={!canNext || saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Sparkles />} Skapa planen
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Nästa <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
