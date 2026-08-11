import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { CalendarDays, Copy, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

import heroImage from "@/assets/hero-plan.jpg";
import { IntentsBanner } from "@/components/plans/IntentsBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PLAN_TYPES,
  TRIP_SUBCATEGORIES,
  daysUntil,
  initials,
  type Participant,
  type Plan,
} from "@/lib/plans";

interface Props {
  plan: Plan;
  participants: Participant[];
  meId: string | null;
}

export function OverviewTab({ plan, participants, meId }: Props) {
  const countdown = daysUntil(plan.start_date);
  const nights =
    plan.start_date && plan.end_date
      ? differenceInCalendarDays(parseISO(plan.end_date), parseISO(plan.start_date))
      : null;

  const typeLabel =
    TRIP_SUBCATEGORIES.find((s) => s.id === plan.subcategory)?.label ??
    PLAN_TYPES.find((t) => t.id === plan.plan_type)?.label ??
    "Plan";

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${plan.share_code}` : "";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
        <img
          src={heroImage}
          alt={`Stämningsbild för ${plan.destination}`}
          width={1600}
          height={912}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/20" />
        <div className="relative flex min-h-[15rem] flex-col justify-end gap-3 p-6 sm:min-h-[18rem] sm:p-8">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            <MapPin className="size-3.5" /> {typeLabel}
          </span>
          <h2 className="font-display text-4xl font-bold leading-none text-white sm:text-5xl">
            {plan.destination}
          </h2>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {plan.start_date ? format(parseISO(plan.start_date), "d MMM", { locale: sv }) : "–"}
              {plan.end_date ? ` – ${format(parseISO(plan.end_date), "d MMM yyyy", { locale: sv })}` : ""}
            </span>
            {nights !== null && <span>{nights === 0 ? "En dag" : `${nights} nätter`}</span>}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> {participants.length} deltagare
            </span>
          </div>
          <p className="font-display text-lg font-bold text-white">
            {countdown === null
              ? "Datum saknas"
              : countdown > 0
                ? `${countdown} dagar till avfärd`
                : countdown === 0
                  ? "Det är dags – idag!"
                  : "Resan är genomförd"}
          </p>
        </div>
      </section>


      <section className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <Users className="size-4 text-accent" /> Deltagare
            <Badge variant="secondary">{participants.length}</Badge>
          </h2>
          <Button
            variant="soft"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(shareUrl);
              toast.success("Delningslänk kopierad");
            }}
          >
            <Copy /> Dela länk
          </Button>
        </div>
        <ul className="mt-4 flex flex-wrap gap-2">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-full border border-border bg-muted/60 py-1 pl-1 pr-3"
            >
              <span
                className="flex size-7 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                style={{ backgroundColor: p.color }}
              >
                {initials(p.name)}
              </span>
              <span className="text-sm font-medium">{p.name}</span>
              {p.id === meId && <Badge className="h-4 px-1.5 text-[10px]">Du</Badge>}
            </li>
          ))}
        </ul>
      </section>

      <IntentsBanner destination={plan.destination} />
    </div>
  );
}
