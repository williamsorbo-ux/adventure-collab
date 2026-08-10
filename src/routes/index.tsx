import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { ArrowRight, Images, MapPin, MessageCircle, Plus, Split, Sparkles } from "lucide-react";

import { PlanWizard } from "@/components/plans/PlanWizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyPlans, type MyPlanEntry } from "@/lib/plans";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plans – planera resan, splitta kostnader, spara minnen" },
      {
        name: "description",
        content:
          "Plans är allt-i-ett för kompisresor och event: översikt med nedräkning, gruppchatt, kostnadsdelning i flera valutor och en gemensam minnesbank.",
      },
      { property: "og:title", content: "Plans – planera resan, splitta kostnader, spara minnen" },
      {
        property: "og:description",
        content:
          "Skapa en plan i fyra steg, dela länken och låt kompisarna gå med utan inloggning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: MapPin,
    title: "Översikt",
    body: "Destination, nedräkning till avfärd och vilka som är med – plus smarta tips på plats.",
  },
  {
    icon: MessageCircle,
    title: "Chatt",
    body: "Ett realtidsflöde för hela sällskapet, kopplat direkt till planen.",
  },
  {
    icon: Split,
    title: "Kostnadsdelning",
    body: "Utgifter i SEK, EUR, USD eller CZK. Dela lika eller procentuellt och se vem som är skyldig vem.",
  },
  {
    icon: Images,
    title: "Minnesbank",
    body: "Ladda upp bilder och korta videor under resan – allt samlas i ett gemensamt galleri.",
  },
];

function Index() {
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [myPlans, setMyPlans] = useState<MyPlanEntry[]>([]);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    setMyPlans(getMyPlans());
  }, [wizardOpen]);

  return (
    <main className="min-h-screen bg-canvas-glow">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <span className="font-display text-xl font-bold text-primary">Plans</span>
        <Button variant="hero" size="sm" onClick={() => setWizardOpen(true)}>
          <Plus /> Skapa ny Plan
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-14 pt-6 sm:pt-14">
        <p className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" /> Resor · Event · Helger
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">
          Planera resan, splitta kostnaderna och spara minnena – på ett ställe.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Skapa en plan i fyra snabba steg, dela länken med gänget och låt alla gå med med bara sitt
          namn. Ingen inloggning, inget krångel.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button variant="hero" size="lg" onClick={() => setWizardOpen(true)}>
            Skapa ny Plan <ArrowRight />
          </Button>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toLowerCase();
              if (code) navigate({ to: "/p/$code", params: { code } });
            }}
          >
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Har du en kod?"
              className="h-11 w-40 bg-card"
              maxLength={20}
            />
            <Button type="submit" variant="outline" size="lg">
              Gå med
            </Button>
          </form>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <article key={f.title} className="card-surface p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft">
                <f.icon className="size-5 text-accent" />
              </span>
              <h2 className="mt-3 font-display text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>

        {myPlans.length > 0 && (
          <section className="mt-14">
            <h2 className="font-display text-xl font-bold">Dina planer</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {myPlans.map((p) => (
                <li key={p.code}>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/p/$code", params: { code: p.code } })}
                    className="card-surface w-full p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary"
                  >
                    <p className="font-display font-semibold">{p.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.destination}
                      {p.start_date
                        ? ` · ${format(parseISO(p.start_date), "d MMM yyyy", { locale: sv })}`
                        : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>

      <PlanWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </main>
  );
}
