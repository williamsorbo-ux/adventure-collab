import { ExternalLink, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface Props {
  destination: string;
}

export function IntentsBanner({ destination }: Props) {
  const city = destination.split(",")[0]?.trim() || "destinationen";

  const intents = [
    {
      emoji: "🚐",
      title: `Boka transfer i ${city}`,
      body: "Flygplats till hotell, fast pris för hela gänget.",
    },
    {
      emoji: "🏆",
      title: `Topp 3 aktiviteter i ${city}`,
      body: "Handplockade upplevelser som passar sällskapet.",
    },
    {
      emoji: "🍽️",
      title: `Bord för gruppen i ${city}`,
      body: "Restauranger som tar emot stora bokningar.",
    },
  ];

  return (
    <section aria-label="Tips och partners" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Smarta tips</h2>
        <Badge variant="secondary" className="text-[10px] uppercase">
          Sponsrat
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {intents.map((intent) => (
          <button
            key={intent.title}
            type="button"
            className="card-surface group flex flex-col items-start gap-1 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent"
          >
            <span className="text-xl">{intent.emoji}</span>
            <p className="flex items-center gap-1 font-semibold text-accent">
              {intent.title}
              <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </p>
            <p className="text-xs text-muted-foreground">{intent.body}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
