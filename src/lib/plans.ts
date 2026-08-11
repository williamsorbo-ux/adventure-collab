import { supabase } from "@/integrations/supabase/client";

export const CURRENCIES = ["SEK", "EUR", "USD", "CZK", "NOK", "DKK", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PLAN_TYPES = [
  { id: "resa", label: "Resa", emoji: "✈️", hint: "Flera dagar, ny destination" },
  { id: "event", label: "Event", emoji: "🎟️", hint: "Konsert, fest, match" },
  { id: "helg", label: "Helg", emoji: "🌤️", hint: "Kort och intensivt" },
  { id: "annat", label: "Annat", emoji: "✨", hint: "Ni bestämmer formen" },
] as const;

export const TRIP_SUBCATEGORIES = [
  { id: "kompisresa", label: "Kompisresa", emoji: "🧳" },
  { id: "svensexa", label: "Svensexa", emoji: "🤵" },
  { id: "mohippa", label: "Möhippa", emoji: "👰" },
  { id: "skidresa", label: "Skidresa", emoji: "🎿" },
  { id: "sportresa", label: "Sportresa", emoji: "🏟️" },
] as const;

export const PARTICIPANT_COLORS = [
  "#cc3300",
  "#3366cc",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export interface Plan {
  id: string;
  share_code: string;
  plan_type: string;
  subcategory: string | null;
  title: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  plan_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Message {
  id: string;
  plan_id: string;
  participant_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface ExpenseShare {
  id: string;
  expense_id: string;
  participant_id: string;
  percent: number;
}

export interface Expense {
  id: string;
  plan_id: string;
  payer_id: string;
  amount: number;
  currency: string;
  description: string;
  split_mode: string;
  created_at: string;
  expense_shares: ExpenseShare[];
}

export interface Settlement {
  id: string;
  plan_id: string;
  from_participant_id: string;
  to_participant_id: string;
  amount: number;
  currency: string;
  created_at: string;
}

export interface Memory {
  id: string;
  plan_id: string;
  uploader_name: string;
  storage_path: string;
  media_type: string;
  caption: string | null;
  created_at: string;
}

/* ---------- guest identity (no login required) ---------- */

const KEY_PREFIX = "plans.guest.";
const MY_PLANS_KEY = "plans.mine";

export interface GuestIdentity {
  participantId: string;
  name: string;
}

export function getGuest(planId: string): GuestIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + planId);
    return raw ? (JSON.parse(raw) as GuestIdentity) : null;
  } catch {
    return null;
  }
}

export function setGuest(planId: string, identity: GuestIdentity) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + planId, JSON.stringify(identity));
}

export interface MyPlanEntry {
  code: string;
  title: string;
  destination: string;
  start_date: string | null;
}

export function getMyPlans(): MyPlanEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_PLANS_KEY);
    return raw ? (JSON.parse(raw) as MyPlanEntry[]) : [];
  } catch {
    return [];
  }
}

export function rememberPlan(entry: MyPlanEntry) {
  if (typeof window === "undefined") return;
  const list = getMyPlans().filter((p) => p.code !== entry.code);
  list.unshift(entry);
  window.localStorage.setItem(MY_PLANS_KEY, JSON.stringify(list.slice(0, 12)));
}

/* ---------- helpers ---------- */

export function makeShareCode(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/* ---------- split math ---------- */

export interface Debt {
  from: string;
  to: string;
  amount: number;
  currency: string;
}

/** Net balance per participant per currency. Positive = ska få tillbaka. */
export function computeBalances(
  expenses: Expense[],
  settlements: Settlement[],
): Record<string, Record<string, number>> {
  const byCurrency: Record<string, Record<string, number>> = {};
  const bump = (currency: string, participant: string, delta: number) => {
    byCurrency[currency] ??= {};
    byCurrency[currency]![participant] = (byCurrency[currency]![participant] ?? 0) + delta;
  };

  for (const e of expenses) {
    const shares = e.expense_shares ?? [];
    if (shares.length === 0) continue;
    bump(e.currency, e.payer_id, Number(e.amount));
    if (e.split_mode === "percent") {
      const total = shares.reduce((s, sh) => s + Number(sh.percent), 0) || 100;
      for (const sh of shares) {
        bump(e.currency, sh.participant_id, -(Number(e.amount) * Number(sh.percent)) / total);
      }
    } else {
      const each = Number(e.amount) / shares.length;
      for (const sh of shares) bump(e.currency, sh.participant_id, -each);
    }
  }

  for (const s of settlements) {
    bump(s.currency, s.from_participant_id, Number(s.amount));
    bump(s.currency, s.to_participant_id, -Number(s.amount));
  }

  return byCurrency;
}

/** Greedy settle-up: vem ska betala vem. */
export function computeDebts(balances: Record<string, Record<string, number>>): Debt[] {
  const debts: Debt[] = [];
  for (const [currency, perParticipant] of Object.entries(balances)) {
    const creditors = Object.entries(perParticipant)
      .filter(([, v]) => v > 0.01)
      .map(([id, v]) => ({ id, v }))
      .sort((a, b) => b.v - a.v);
    const debtors = Object.entries(perParticipant)
      .filter(([, v]) => v < -0.01)
      .map(([id, v]) => ({ id, v: -v }))
      .sort((a, b) => b.v - a.v);

    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i]!.v, creditors[j]!.v);
      if (amount > 0.01) {
        debts.push({
          from: debtors[i]!.id,
          to: creditors[j]!.id,
          amount: Math.round(amount * 100) / 100,
          currency,
        });
      }
      debtors[i]!.v -= amount;
      creditors[j]!.v -= amount;
      if (debtors[i]!.v <= 0.01) i++;
      if (creditors[j]!.v <= 0.01) j++;
    }
  }
  return debts;
}

/* ---------- data access ---------- */

export async function fetchPlanByCode(code: string) {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("share_code", code)
    .maybeSingle();
  if (error) throw error;
  return (data as Plan | null) ?? null;
}

export async function fetchParticipants(planId: string) {
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Participant[];
}

export async function fetchMessages(planId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function fetchExpenses(planId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*, expense_shares(*)")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Expense[];
}

export async function fetchSettlements(planId: string) {
  const { data, error } = await supabase.from("settlements").select("*").eq("plan_id", planId);
  if (error) throw error;
  return (data ?? []) as Settlement[];
}

export async function fetchMemories(planId: string) {
  const { data, error } = await supabase
    .from("memories")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Memory[];
}

export async function signMemoryUrls(paths: string[]) {
  if (paths.length === 0) return {} as Record<string, string>;
  const { data, error } = await supabase.storage.from("memories").createSignedUrls(paths, 3600);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

export async function joinPlan(planId: string, name: string, colorIndex: number) {
  const { data, error } = await supabase
    .from("participants")
    .insert({
      plan_id: planId,
      name,
      color: PARTICIPANT_COLORS[colorIndex % PARTICIPANT_COLORS.length]!,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Participant;
}

/* ---------- todos ---------- */

export interface TodoAssignee {
  id: string;
  todo_id: string;
  participant_id: string;
}

export interface Todo {
  id: string;
  plan_id: string;
  title: string;
  done: boolean;
  done_at: string | null;
  created_by_name: string | null;
  created_at: string;
  todo_assignees: TodoAssignee[];
}

export async function fetchTodos(planId: string) {
  const { data, error } = await supabase
    .from("todos")
    .select("*, todo_assignees(*)")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Todo[];
}

/* ---------- per person totals ---------- */

export interface PersonTotals {
  paid: number;
  owed: number;
  net: number;
}

/** Totalt betalat / konsumerat / netto per valuta och person (exkl. regleringar). */
export function computePersonTotals(
  expenses: Expense[],
): Record<string, Record<string, PersonTotals>> {
  const out: Record<string, Record<string, PersonTotals>> = {};
  const ensure = (currency: string, id: string) => {
    out[currency] ??= {};
    out[currency]![id] ??= { paid: 0, owed: 0, net: 0 };
    return out[currency]![id]!;
  };

  for (const e of expenses) {
    const shares = e.expense_shares ?? [];
    if (shares.length === 0) continue;
    ensure(e.currency, e.payer_id).paid += Number(e.amount);
    if (e.split_mode === "percent") {
      const total = shares.reduce((s, sh) => s + Number(sh.percent), 0) || 100;
      for (const sh of shares) {
        ensure(e.currency, sh.participant_id).owed +=
          (Number(e.amount) * Number(sh.percent)) / total;
      }
    } else {
      const each = Number(e.amount) / shares.length;
      for (const sh of shares) ensure(e.currency, sh.participant_id).owed += each;
    }
  }

  for (const perPerson of Object.values(out)) {
    for (const t of Object.values(perPerson)) t.net = t.paid - t.owed;
  }
  return out;
}
