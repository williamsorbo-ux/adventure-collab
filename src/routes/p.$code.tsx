import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckSquare, Loader2, MessageCircle, Sparkles, Wallet, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import { ChatTab } from "@/components/plans/ChatTab";
import { MemoriesTab } from "@/components/plans/MemoriesTab";
import { OverviewTab, type PlanTab } from "@/components/plans/OverviewTab";
import { SplitsTab } from "@/components/plans/SplitsTab";
import { TodosTab } from "@/components/plans/TodosTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLAN_TYPES,
  TRIP_SUBCATEGORIES,
  fetchParticipants,
  fetchPlanByCode,
  getGuest,
  joinPlan,
  rememberPlan,
  setGuest,
  type Participant,
  type Plan,
} from "@/lib/plans";

export const Route = createFileRoute("/p/$code")({
  head: () => ({
    meta: [
      { title: "Din Plan – Plans" },
      {
        name: "description",
        content:
          "Översikt, chatt, kostnadsdelning och minnesbank för din resa eller event – dela länken med gänget.",
      },
      { property: "og:title", content: "Din Plan – Plans" },
      {
        property: "og:description",
        content: "Planera resan, splitta utgifterna och samla minnena på ett ställe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { code } = Route.useParams();
  const queryClient = useQueryClient();
  const [meId, setMeId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<PlanTab>("overview");
  const [startExpense, setStartExpense] = useState(false);

  const planQuery = useQuery({
    queryKey: ["plan", code],
    queryFn: () => fetchPlanByCode(code),
  });
  const plan = planQuery.data ?? null;

  const participantsQuery = useQuery({
    queryKey: ["participants", plan?.id],
    queryFn: () => fetchParticipants(plan!.id),
    enabled: !!plan,
  });
  const participants = participantsQuery.data ?? [];

  useEffect(() => {
    if (!plan) return;
    const guest = getGuest(plan.id);
    setMeId(guest?.participantId ?? null);
    setHydrated(true);
    rememberPlan({
      code: plan.share_code,
      title: plan.title,
      destination: plan.destination,
      start_date: plan.start_date,
    });
  }, [plan]);

  const me = participants.find((p) => p.id === meId) ?? null;

  if (planQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl font-bold">Planen hittades inte</h1>
        <p className="text-sm text-muted-foreground">Länken kan vara felaktig eller borttagen.</p>
        <Button asChild variant="hero">
          <Link to="/">Till startsidan</Link>
        </Button>
      </main>
    );
  }

  const typeLabel =
    TRIP_SUBCATEGORIES.find((s) => s.id === plan.subcategory)?.label ??
    PLAN_TYPES.find((t) => t.id === plan.plan_type)?.label ??
    "Plan";

  const navItems: { id: PlanTab; label: string; Icon: typeof Wallet }[] = [
    { id: "overview", label: "Översikt", Icon: LayoutDashboard },
    { id: "splits", label: "Pengar", Icon: Wallet },
    { id: "todos", label: "Att göra", Icon: CheckSquare },
    { id: "chat", label: "Chatt", Icon: MessageCircle },
    { id: "memories", label: "Bilder", Icon: Camera },
  ];
  const joined = !(hydrated && !me);

  return (
    <main className="min-h-screen pb-24">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/" className="font-display text-lg font-bold text-primary">
            Plans
          </Link>
          <span className="text-border">/</span>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold">{plan.title}</h1>
          <Badge variant="secondary">{typeLabel}</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {!joined ? (
          <JoinCard
            plan={plan}
            participantCount={participants.length}
            onJoined={(participant) => {
              setGuest(plan.id, { participantId: participant.id, name: participant.name });
              setMeId(participant.id);
              void queryClient.invalidateQueries({ queryKey: ["participants", plan.id] });
            }}
          />
        ) : (
          <>
            {tab === "overview" && (
              <OverviewTab
                plan={plan}
                participants={participants}
                meId={meId}
                onNavigate={(t, opts) => {
                  setStartExpense(!!opts?.newExpense);
                  setTab(t);
                }}
              />
            )}
            {tab === "chat" && <ChatTab plan={plan} participants={participants} me={me} />}
            {tab === "todos" && <TodosTab plan={plan} participants={participants} me={me} />}
            {tab === "splits" && (
              <SplitsTab
                plan={plan}
                participants={participants}
                me={me}
                startOpen={startExpense}
              />
            )}
            {tab === "memories" && <MemoriesTab plan={plan} me={me} />}
          </>
        )}
      </div>

      {joined && (
        <nav
          aria-label="Planens delar"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto flex max-w-2xl">
            {navItems.map(({ id, label, Icon }) => (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setStartExpense(false);
                    setTab(id);
                  }}
                  aria-current={tab === id ? "page" : undefined}
                  className={`flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs ${
                    tab === id ? "font-bold text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="size-6" />
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}

function JoinCard({
  plan,
  participantCount,
  onJoined,
}: {
  plan: Plan;
  participantCount: number;
  onJoined: (participant: Participant) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function join() {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      const participant = await joinPlan(plan.id, name.trim(), participantCount);
      onJoined(participant);
      toast.success(`Välkommen, ${participant.name}!`);
    } catch (err) {
      console.error(err);
      toast.error("Kunde inte gå med. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card-surface overflow-hidden">
        <div className="bg-gradient-primary px-6 py-6 text-primary-foreground">
          <p className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-90">
            <Sparkles className="size-3.5" /> Du är inbjuden
          </p>
          <h2 className="mt-2 font-display text-xl font-bold">{plan.title}</h2>
          <p className="text-sm opacity-90">{plan.destination}</p>
        </div>
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="guest-name">Vad heter du?</Label>
            <Input
              id="guest-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="Ditt namn"
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === "Enter") void join();
              }}
            />
            <p className="text-xs text-muted-foreground">
              Ingen inloggning behövs – skriv namnet och du är med i gänget.
            </p>
          </div>
          <Button variant="hero" className="w-full" disabled={saving || name.trim().length < 2} onClick={() => void join()}>
            {saving ? <Loader2 className="animate-spin" /> : null} Gå med i planen
          </Button>
        </div>
      </div>
    </div>
  );
}
