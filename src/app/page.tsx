import Link from "next/link";
import supplier from "@/data/supplier.json";
import rules from "@/data/rules.json";
import { recommend, type Account, type Rule } from "@/lib/settle.ts";
import { Mark } from "./logo";

// Same comparison the supplier page shows, so the headline number can't drift from the demo.
const rows = (supplier.accounts as Account[]).map(a => recommend(a, (rules.states as Record<string, Rule>)[a.state], rules.networkCapPct));
const yearlyGain = rows.reduce((t, r) => t + r.pick.annualValue - r.options.find(o => o.kind === "surcharge")!.annualValue, 0);

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-ink">{children}</strong>;
const L = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-lime">{children}</strong>;

const STEPS = [
  { title: "Read", body: <>Claude reads the supplier&rsquo;s PDF into typed line items. Quantities, prices and totals must <B>reconcile to the cent</B>, or nothing moves.</> },
  { title: "Code", body: <>PO matches and consistent history are coded by <B>plain rules</B>. Only the hard lines go to the model, which has to <B>cite its evidence</B>. Under 70% confidence, <B>a person decides</B>.</> },
  { title: "Split", body: <>Tax spreads over taxable lines, card fees over everything, <B>each project to the exact cent</B>. Journal entries come out ready to post.</> },
  { title: "Settle", body: <>The same line items ride with the card payment for <B>lower commercial rates</B>, and the supplier gets a <B>fee policy for this customer</B>, checked against state law.</> },
];

const OLD = [
  <>One invoice covers three projects, so someone <B>splits it line by line in a spreadsheet</B>.</>,
  <>The card surcharge <B>lands in overhead</B>, and no project&rsquo;s costs are quite right.</>,
  <>The card payment carries no purchase detail, so the supplier <B>pays the top rate</B>.</>,
  <>Every customer gets <B>the same 3% surcharge</B>, loyal accounts included, <B>even in states that ban it</B>.</>,
];

const NEW = [
  <>Lines are <L>coded automatically</L>, each with a reason, and a person <L>only sees the doubtful ones</L>.</>,
  <>Tax and fees are split across projects <L>to the exact cent</L>.</>,
  <><L>Structured line items</L> go out with the card payment, so it qualifies for <L>lower rates</L>.</>,
  <>Each customer gets <L>its own policy</L>: surcharge, absorb, ACH discount, or a waived fee for faster payment.</>,
];

export default function Home() {
  return (
    <div className="space-y-20 pb-8">
      <section className="grid items-center gap-10 pt-6 md:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <p className="text-sm font-medium uppercase tracking-widest text-muted">B2B invoices · project costing · card payments</p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Every invoice, <span className="marker">split right</span> and paid smart.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Settle reads a supplier invoice once and puts it to work on <B>both sides</B>. <B>Buyers</B> get every line coded to the right project. <B>Suppliers</B> get cheaper card payments and a fee policy that fits each customer.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/invoice/INV-1042" className="rounded-full bg-lime px-5 py-2.5 font-medium text-ink hover:brightness-95">Run the demo invoice →</Link>
            <Link href="/supplier" className="rounded-full border border-ink px-5 py-2.5 font-medium hover:bg-ink hover:text-white">See the supplier view</Link>
          </div>
        </div>
        <SplitIllustration />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">The old way</h2>
          <ul className="mt-4 space-y-3 text-[15px] text-muted">
            {OLD.map((t, i) => <li key={i} className="flex gap-3"><span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bad-soft text-xs font-bold text-bad">✕</span><span>{t}</span></li>)}
          </ul>
        </div>
        <div className="rounded-2xl bg-ink p-6 text-white">
          <h2 className="text-sm font-medium uppercase tracking-widest text-lime">With Settle</h2>
          <ul className="mt-4 space-y-3 text-[15px] text-white/80">
            {NEW.map((t, i) => <li key={i} className="flex gap-3"><span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-xs font-bold text-ink">✓</span><span>{t}</span></li>)}
          </ul>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-surface p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-sm font-semibold">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 rounded-2xl bg-lime p-6 sm:grid-cols-3 sm:p-8">
        <Big value={`$${Math.round(yearlyGain / 1000)}k/yr`} label="better than a blanket surcharge across the demo supplier's 10 accounts" />
        <Big value="$0.00" label="rounding drift: every project split adds back to the invoice total" />
        <Big value="0" label="surcharges suggested where state law bans them or sources disagree" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Side title="For buyers" who="Contractors, agencies, property managers, nonprofits: anyone who tracks spend by project, client, property or grant." points={["Line-level coding from POs, past coding and crew timesheets", "Reasons on every line, and human review under 70% confidence", "Journal entries and CSV, ready for the ledger"]} href="/invoice/INV-1042" cta="Code an invoice" />
        <Side title="For suppliers" who="Distributors and wholesalers on thin margins who lose 2–3% on every card payment." points={["Line-item data attached to card payments", "Per-customer fee policy from margin, lifetime value, payment speed and churn risk", "State surcharge rules and card network caps, with sources"]} href="/supplier" cta="Set card policy" />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-muted">
        <span className="inline-flex items-center gap-2"><Mark size={20} /> Built by Split Decision: Srishti Hazra, Riya Pallikonda, Anagha Taneja</span>
        <a href="https://github.com/srishti-h/settle" className="underline hover:text-ink">Code &amp; design decisions on GitHub</a>
      </footer>
    </div>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-semibold tracking-tight num">{value}</div>
      <p className="mt-1 text-sm">{label}</p>
    </div>
  );
}

function Side({ title, who, points, href, cta }: { title: string; who: string; points: string[]; href: string; cta: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted">{who}</p>
      <ul className="mt-4 flex-1 space-y-2 text-[15px]">
        {points.map(p => <li key={p} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />{p}</li>)}
      </ul>
      <Link href={href} className="mt-6 self-start font-medium underline decoration-lime decoration-4 underline-offset-4 hover:decoration-ink">{cta} →</Link>
    </div>
  );
}

// Static picture of the core idea: one invoice, lines fanned out to projects.
function SplitIllustration() {
  const lines = [
    { item: "THHN #12 wire, 4 reels", amt: "$1,648", to: "Hospital", why: "PO-2201" },
    { item: "EMT conduit, 300 ft", amt: "$2,355", to: "School", why: "3/3 history" },
    { item: "LED high-bays × 24", amt: "$5,148", to: "Warehouse", why: "crew schedule" },
  ];
  return (
    <div className="rounded-2xl bg-ink p-5 text-white shadow-xl" aria-label="Example: one invoice split across three projects">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>INV-1042 · Volt Supply Co.</span><span className="num">$18,781.27</span>
      </div>
      <ul className="mt-4 space-y-2">
        {lines.map(l => (
          <li key={l.item} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-sm">
            <span className="flex-1">{l.item}<span className="block text-xs text-white/50">{l.why}</span></span>
            <span className="num text-white/70">{l.amt}</span>
            <span className="rounded-full bg-lime px-2.5 py-0.5 text-xs font-medium text-ink">{l.to}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/15 p-3"><div className="text-white/50">Card fee</div><div className="mt-1 text-base num"><s className="text-white/40">$528.79</s> $437.62</div></div>
        <div className="rounded-xl border border-white/15 p-3"><div className="text-white/50">Policy for this customer</div><div className="mt-1 text-base">No card fee if paid in 10 days</div></div>
      </div>
    </div>
  );
}
