import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { CalendarDays, Copy, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

import { IntentsBanner } from "@/components/plans/IntentsBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { daysUntil, initials, type Participant, type Plan } from "@/lib/plans";

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

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${plan.share_code}` : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <MapPin className="size-3.5 text-accent" /> Destination
          </p>
          <p className="mt-2 font-display text-xl font-bold">{plan.destination}</p>
          {nights !== null && (
            <p className="text-sm text-muted-foreground">
              {nights === 0 ? "En dag" : `${nights} nätter`}
            </p>
          )}
        </div>

        <div className="card-surface bg-gradient-primary p-5 text-primary-foreground">
          <p className="text-xs font-medium uppercase tracking-wide opacity-90">Nedräkning</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none">
            {countdown === null ? "–" : countdown > 0 ? countdown : countdown === 0 ? "Idag" : "Klart"}
          </p>
          <p className="mt-1 text-sm opacity-90">
            {countdown !== null && countdown > 0
              ? `dagar till avfärd`
              : countdown === 0
                ? "Det är dags!"
                : "Resan är genomförd"}
          </p>
        </div>

        <div className="card-surface p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="size-3.5 text-accent" /> Datum
          </p>
          <p className="mt-2 font-display text-lg font-bold">
            {plan.start_date ? format(parseISO(plan.start_date), "d MMM", { locale: sv }) : "–"}
            {plan.end_date ? ` – ${format(parseISO(plan.end_date), "d MMM yyyy", { locale: sv })}` : ""}
          </p>
        </div>
      </div>

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
