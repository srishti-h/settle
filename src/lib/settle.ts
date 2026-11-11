// Pure logic shared by API routes, client components and tests. No I/O here.
// Ledger amounts are integer cents; strategy estimates are annual dollars.

export type Line = {
  n: number; sku: string; description: string; qty: number; uom: string;
  unitCents: number; amountCents: number; taxable: boolean; po?: string;
};
export type Invoice = {
  id: string; supplier: string; buyer: string; date: string; pdf: string; lines: Line[];
  subtotalCents: number; taxCents: number; surchargeCents: number; totalCents: number;
};
export type Project = { id: string; name: string; active: boolean };
export type PO = { id: string; project: string; costCode: string; skus: string[] };
export type HistoryRow = { date: string; sku: string; description: string; project: string; costCode: string };
export type Timesheet = { date: string; project: string; crew: string; note: string };
export type Buyer = { company: string; projects: Project[]; costCodes: { code: string; name: string }[]; purchaseOrders: PO[]; timesheets: Timesheet[]; history: HistoryRow[] };
export type Guess = { project: string | null; costCode: string | null; confidence: number; reason: string };
export type Coded = Line & Guess & { tier: "po" | "history" | "model" | "person"; review: boolean };

export const REVIEW_BELOW = 0.7;

// Model output and PDF extraction are untrusted: the printed totals must reconcile.
export function checkInvoice(inv: Invoice): string[] {
  const errs: string[] = [];
  for (const l of inv.lines)
    if (l.qty * l.unitCents !== l.amountCents) errs.push(`Line ${l.n}: ${l.qty} × ${l.unitCents}¢ ≠ ${l.amountCents}¢`);
  const sub = inv.lines.reduce((a, l) => a + l.amountCents, 0);
  if (sub !== inv.subtotalCents) errs.push(`Lines sum to ${sub}¢, invoice says ${inv.subtotalCents}¢`);
  if (sub + inv.taxCents + inv.surchargeCents !== inv.totalCents) errs.push("Subtotal + tax + surcharge ≠ total");
  return errs;
}

// Tier 1: deterministic matches. Returns null when a human or the model has to decide.
export function codeByRules(line: Line, b: Buyer): Coded | null {
  const active = new Set(b.projects.filter(p => p.active).map(p => p.id));
  const name = (id: string) => b.projects.find(p => p.id === id)?.name ?? id;
  const po = b.purchaseOrders.find(p => p.id === line.po);
  if (po && active.has(po.project))
    return { ...line, project: po.project, costCode: po.costCode, confidence: 0.97, reason: `Matches ${po.id} (${name(po.project)})`, tier: "po", review: false };
  const past = b.history.filter(h => h.sku === line.sku && active.has(h.project));
  if (past.length >= 2 && past.every(h => h.project === past[0].project && h.costCode === past[0].costCode))
    return { ...line, project: past[0].project, costCode: past[0].costCode, confidence: 0.9, reason: `SKU coded to ${name(past[0].project)} ${past.length}/${past.length} times before`, tier: "history", review: false };
  return null;
}

// Tier 2 guard: never trust a project or cost code the model invented.
export function acceptGuess(line: Line, g: Guess, b: Buyer): Coded {
  const ok = b.projects.some(p => p.active && p.id === g.project) && b.costCodes.some(c => c.code === g.costCode);
  const confidence = ok ? Math.max(0, Math.min(1, g.confidence)) : 0;
  return { ...line, ...(ok ? g : { project: null, costCode: null, reason: `Model suggested an unknown code: ${g.reason}` }), confidence, tier: "model", review: confidence < REVIEW_BELOW };
}

// Largest-remainder rounding: shares always sum exactly to totalCents.
export function allocate(totalCents: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);
  const raw = weights.map(w => (totalCents * w) / sum);
  const out = raw.map(Math.floor);
  const left = totalCents - out.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => out[i]++);
  return out;
}

export type SplitRow = { project: string; materialsCents: number; taxCents: number; feeCents: number; totalCents: number };

// Tax spreads over taxable lines only; the card surcharge spreads over everything.
export function splitByProject(lines: Coded[], inv: Invoice): SplitRow[] {
  const keys = [...new Set(lines.map(l => l.project ?? "UNASSIGNED"))];
  const of = (k: string, f: (l: Coded) => number) => lines.filter(l => (l.project ?? "UNASSIGNED") === k).reduce((a, l) => a + f(l), 0);
  const mat = keys.map(k => of(k, l => l.amountCents));
  const tax = allocate(inv.taxCents, keys.map(k => of(k, l => (l.taxable ? l.amountCents : 0))));
  const fee = allocate(inv.surchargeCents, mat.map((m, i) => m + tax[i]));
  return keys.map((project, i) => ({ project, materialsCents: mat[i], taxCents: tax[i], feeCents: fee[i], totalCents: mat[i] + tax[i] + fee[i] }));
}

// The structured data that travels with the card payment. Field list is illustrative,
// modelled on what enhanced-data programs ask for, not any one network's spec.
export function enhancedData(inv: Invoice, lines: Coded[]) {
  const payload = {
    invoiceNumber: inv.id,
    customerReference: [...new Set(lines.map(l => l.po).filter(Boolean))].join(",") || null,
    taxAmountCents: inv.taxCents,
    lineItems: lines.map(l => ({ sku: l.sku, description: l.description, quantity: l.qty, unitOfMeasure: l.uom, unitCostCents: l.unitCents, totalCents: l.amountCents, buyerProject: l.project, buyerCostCode: l.costCode })),
  };
  const missing: string[] = [];
  if (!payload.customerReference) missing.push("customer reference / PO");
  if (inv.taxCents === 0 && lines.some(l => l.taxable)) missing.push("tax amount");
  lines.forEach(l => { if (!l.uom || !l.qty) missing.push(`unit of measure / qty on line ${l.n}`); });
  return { payload, missing, qualifies: missing.length === 0 };
}

// Illustrative card-acceptance rates; real ones vary by card, processor and data quality.
export const RATES = { standard: 0.029, enhanced: 0.024 };

export type Account = { id: string; name: string; state: string; monthlyRevenue: number; marginPct: number; tenureMonths: number; orderTrend: number; cardShare: number; avgDaysToPay: number; competitorNearby: boolean };
export type Rule = { surcharge: "allowed" | "capped" | "banned" | "unclear"; capPct?: number; note?: string; sources: string[] };
export type Option = { kind: "surcharge" | "absorb" | "ach_discount" | "fee_relief"; label: string; annualValue: number; allowed: boolean; why: string };

const LTV_MONTHS = 36, ACH_DISCOUNT = 0.01, ACH_UPTAKE = 0.5, COST_OF_CAPITAL = 0.1, FAST_TERMS_DAYS = 10;
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const usd = (x: number) => `$${Math.round(Math.abs(x)).toLocaleString("en-US")}`;

// How likely a fee is to push this account to a competitor (0–1). Transparent on purpose:
// shortcut: hand-tuned weights, replace with a model fit on real churn data once it exists.
export function priceSensitivity(a: Account) {
  return clamp(0.2 + (a.competitorNearby ? 0.4 : 0) + Math.max(0, -a.orderTrend) * 2 - Math.min(a.tenureMonths / 60, 0.3));
}

// Score each option as annual value vs. absorbing nothing (0 = card fees cost us nothing).
export function recommend(a: Account, rule: Rule | undefined, networkCapPct: number, rate = RATES.enhanced) {
  const annualRev = a.monthlyRevenue * 12, card = annualRev * a.cardShare, fee = card * rate;
  const ltv = a.monthlyRevenue * a.marginPct * LTV_MONTHS, s = priceSensitivity(a);
  const status = rule?.surcharge ?? "unclear";
  const cap = Math.min(networkCapPct, status === "capped" ? rule!.capPct! : 1);
  const recovered = fee * Math.min(1, cap / rate);
  const churnCost = (p: number) => p * ltv;
  const finance = annualRev / 365 * Math.max(0, a.avgDaysToPay - FAST_TERMS_DAYS) * COST_OF_CAPITAL;
  const moved = card * ACH_UPTAKE;

  const options: Option[] = [
    { kind: "absorb", label: "Absorb the fee", annualValue: -fee, allowed: true, why: `Pay ${usd(fee)}/yr in card fees, no churn risk` },
    { kind: "surcharge", label: status === "capped" ? `Surcharge (capped at ${+(cap * 100).toFixed(2)}%)` : "Surcharge card payments", annualValue: -(fee - recovered) - churnCost(0.02 + 0.12 * s), allowed: status === "allowed" || status === "capped",
      why: status === "banned" ? `Surcharges are banned in ${a.state}` : status === "unclear" ? `${a.state} rules unclear; needs legal review` : `Recover ${usd(recovered)}/yr, risks ${usd(churnCost(0.02 + 0.12 * s))} of lifetime value` },
    { kind: "ach_discount", label: `${ACH_DISCOUNT * 100}% discount for paying by ACH`, annualValue: -(fee - moved * rate) - moved * ACH_DISCOUNT - churnCost(0.01 * s), allowed: true,
      why: `Shifts ~${ACH_UPTAKE * 100}% of card volume to ACH; costs ${usd(moved * ACH_DISCOUNT)} in discounts, saves ${usd(moved * rate)} in fees` },
    { kind: "fee_relief", label: `No card fee if paid in ${FAST_TERMS_DAYS} days`, annualValue: -fee + finance, allowed: a.avgDaysToPay > 30,
      why: a.avgDaysToPay > 30 ? `Pays in ${a.avgDaysToPay} days today; net-${FAST_TERMS_DAYS} frees cash worth ${usd(finance)}/yr` : `Already pays in ${a.avgDaysToPay} days` },
  ];
  const pick = options.filter(o => o.allowed).sort((x, y) => y.annualValue - x.annualValue)[0];
  const blocked = options.find(o => !o.allowed && o.annualValue > pick.annualValue);
  return { options, pick, blocked, sensitivity: s, ltv, fee, status };
}

export const pct = (x: number) => `${+(x * 100).toFixed(2)}%`;
export const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
