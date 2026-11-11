"use client";
import { useState } from "react";
import Link from "next/link";
import buyerData from "@/data/buyer.json";
import invoices from "@/data/invoices.json";
import supplier from "@/data/supplier.json";
import rules from "@/data/rules.json";
import { enhancedData, money, pct, RATES, recommend, splitByProject, type Account, type Buyer, type Coded, type Invoice, type Rule } from "@/lib/settle.ts";

const b = buyerData as Buyer;
const projectName = (id: string | null) => b.projects.find(p => p.id === id)?.name ?? "Unassigned";
const TIER = { po: "PO match", history: "History", model: "Model", person: "You" };

export default function Workbench({ id }: { id: string }) {
  const seed = (invoices as Invoice[]).find(i => i.id === id)!;
  const [inv, setInv] = useState<Invoice>(seed);
  const [lines, setLines] = useState<Coded[] | null>(null);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [auto, setAuto] = useState(0);

  async function run() {
    setBusy(true); setError(null); setPosted(false);
    const res = await fetch("/api/settle", { method: "POST", body: JSON.stringify({ id }) });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError([body.error, ...(body.errors ?? [])].join(" · "));
    setInv(body.invoice); setLines(body.lines); setLive(body.live);
    setAuto(body.lines.filter((l: Coded) => !l.review).length);
  }

  const confirm = (n: number, project: string, costCode: string) =>
    setLines(ls => ls!.map(l => l.n === n ? { ...l, project, costCode, tier: "person" as const, confidence: 1, review: false, reason: `Confirmed by you. ${l.tier === "model" ? "Model said: " + l.reason : l.reason}` } : l));

  const pending = lines?.filter(l => l.review).length ?? 0;
  const split = lines ? splitByProject(lines, inv) : [];
  const data = lines ? enhancedData(inv, lines) : null;
  const account = (supplier.accounts as Account[]).find(a => a.name === inv.buyer);
  const rec = account && recommend(account, (rules.states as Record<string, Rule>)[account.state], rules.networkCapPct);
  const cardTotal = inv.totalCents - inv.surchargeCents;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-sm text-muted hover:text-ink">← Invoices</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{inv.id} · {inv.supplier} → {inv.buyer}</h1>
          <p className="mt-1 text-sm text-muted num">{inv.lines.length} lines · {money(inv.totalCents)} incl. {money(inv.surchargeCents)} card surcharge · <a className="underline" href={inv.pdf} target="_blank">view PDF</a></p>
        </div>
        <button onClick={run} disabled={busy} className="rounded-full bg-lime px-5 py-2 text-sm font-medium text-ink hover:brightness-95 disabled:opacity-50">
          {busy ? "Reading invoice…" : lines ? "Run again" : "Run Settle"}
        </button>
      </div>

      {error && <p role="alert" className="rounded-md bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}

      {lines && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Coded without a person" value={`${auto} of ${lines.length}`} />
            <Stat label="Waiting on you" value={String(pending)} tone={pending ? "warn" : undefined} />
            <Stat label="Projects charged" value={String(split.filter(r => r.project !== "UNASSIGNED").length)} />
            <Stat label="Supplier fee saved" value={data.qualifies ? money(Math.round(cardTotal * (RATES.standard - RATES.enhanced))) : "$0.00"} />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Buyer side · {inv.buyer}</h2>
            <p className="text-xs text-muted">{live ? "Live model calls." : "Demo mode: model answers come from saved fixtures (no API key set). PO and history matches are always computed."}</p>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-sm">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">#</th><th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th><th className="px-3 py-2 font-medium">Project · cost code</th>
                    <th className="px-3 py-2 font-medium">Confidence</th><th className="px-3 py-2 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(l => <LineRow key={l.n} l={l} onConfirm={confirm} />)}
                </tbody>
              </table>
            </div>

            <h3 className="pt-2 font-medium">Split by project</h3>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-sm num">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">Project</th><th className="px-3 py-2 text-right font-medium">Materials</th>
                    <th className="px-3 py-2 text-right font-medium">Sales tax</th><th className="px-3 py-2 text-right font-medium">Card surcharge</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {split.map(r => (
                    <tr key={r.project} className={`border-b border-line ${r.project === "UNASSIGNED" ? "bg-warn-soft" : ""}`}>
                      <td className="px-3 py-2">{projectName(r.project)}</td><td className="px-3 py-2 text-right">{money(r.materialsCents)}</td>
                      <td className="px-3 py-2 text-right">{money(r.taxCents)}</td><td className="px-3 py-2 text-right">{money(r.feeCents)}</td>
                      <td className="px-3 py-2 text-right font-medium">{money(r.totalCents)}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="px-3 py-2">Invoice total</td><td className="px-3 py-2 text-right">{money(inv.subtotalCents)}</td>
                    <td className="px-3 py-2 text-right">{money(inv.taxCents)}</td><td className="px-3 py-2 text-right">{money(inv.surchargeCents)}</td>
                    <td className="px-3 py-2 text-right">{money(split.reduce((a, r) => a + r.totalCents, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setPosted(true)} disabled={pending > 0} className="rounded-full bg-lime px-5 py-2 text-sm font-medium text-ink hover:brightness-95 disabled:bg-line disabled:text-muted">
                {pending ? `Confirm ${pending} line${pending > 1 ? "s" : ""} to post` : "Approve & post to ledger"}
              </button>
              {posted && <a className="text-sm text-accent underline" href={csv(inv, split)} download={`${inv.id}-journal.csv`}>Download journal entries (CSV)</a>}
            </div>
            {posted && <Journal inv={inv} split={split} />}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Supplier side · {inv.supplier}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-line bg-surface p-4">
                <h3 className="font-medium">Line-item data sent with the card payment</h3>
                {data.qualifies
                  ? <p className="text-sm text-accent">✓ Complete. Eligible for enhanced-data card rates.</p>
                  : <p className="text-sm text-bad">Missing: {data.missing.join(", ")}. Falls back to the standard rate.</p>}
                <p className="text-sm num">Card fee on {money(cardTotal)}: <s className="text-muted">{money(Math.round(cardTotal * RATES.standard))}</s> → <strong>{money(Math.round(cardTotal * (data.qualifies ? RATES.enhanced : RATES.standard)))}</strong></p>
                <p className="text-xs text-muted">Illustrative rates: {pct(RATES.standard)} standard vs {pct(RATES.enhanced)} with complete data.</p>
                <details className="text-xs"><summary className="cursor-pointer text-muted">Show payload</summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded bg-bg p-2 font-mono">{JSON.stringify(data.payload, null, 2)}</pre>
                </details>
              </div>
              {rec && (
                <div className="space-y-2 rounded-lg border border-line bg-surface p-4">
                  <h3 className="font-medium">Card policy for {inv.buyer}</h3>
                  <p className="text-sm num"><span className="text-muted">Today:</span> blanket {pct(supplier.blanketSurchargePct)} surcharge on every customer ({money(inv.surchargeCents)} on this invoice)</p>
                  <p className="text-sm"><span className="text-muted">Settle recommends:</span> <strong>{rec.pick.label}</strong>. {rec.pick.why}.</p>
                  {rec.blocked && <p className="text-xs text-warn">Ruled out: {rec.blocked.label}. {rec.blocked.why}.</p>}
                  <Link href="/supplier" className="text-sm text-accent hover:underline">All accounts →</Link>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className={`rounded-lg border border-line p-3 ${tone ? "bg-warn-soft" : "bg-surface"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold num">{value}</div>
    </div>
  );
}

function LineRow({ l, onConfirm }: { l: Coded; onConfirm: (n: number, project: string, costCode: string) => void }) {
  const [project, setProject] = useState(l.project ?? "");
  const [code, setCode] = useState(l.costCode ?? "");
  return (
    <tr className={`border-b border-line align-top last:border-0 ${l.review ? "bg-warn-soft" : ""}`}>
      <td className="px-3 py-2 num">{l.n}</td>
      <td className="px-3 py-2"><div>{l.description}</div><div className="text-xs text-muted num">{l.qty} {l.uom} × {money(l.unitCents)}{l.po ? ` · ${l.po}` : ""}</div></td>
      <td className="px-3 py-2 text-right num">{money(l.amountCents)}</td>
      <td className="px-3 py-2">
        {l.review ? (
          <div className="flex flex-col gap-1">
            <select aria-label={`Project for line ${l.n}`} value={project} onChange={e => setProject(e.target.value)} className="rounded border border-line bg-surface px-1 py-0.5">
              <option value="" disabled>Pick a project</option>
              {b.projects.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select aria-label={`Cost code for line ${l.n}`} value={code} onChange={e => setCode(e.target.value)} className="rounded border border-line bg-surface px-1 py-0.5">
              <option value="" disabled>Pick a cost code</option>
              {b.costCodes.map(c => <option key={c.code} value={c.code}>{c.code} {c.name}</option>)}
            </select>
            <button disabled={!project || !code} onClick={() => onConfirm(l.n, project, code)} className="self-start rounded bg-ink px-2 py-0.5 text-xs text-white disabled:opacity-40">Confirm</button>
          </div>
        ) : (
          <div><div>{projectName(l.project)}</div><div className="text-xs text-muted">{l.costCode} {b.costCodes.find(c => c.code === l.costCode)?.name}</div></div>
        )}
      </td>
      <td className="px-3 py-2 num">
        <div className="text-xs">{Math.round(l.confidence * 100)}% · {TIER[l.tier]}</div>
        <div className="mt-1 h-1.5 w-20 rounded bg-line"><div className={`h-1.5 rounded ${l.confidence < 0.7 ? "bg-warn" : "bg-accent"}`} style={{ width: `${l.confidence * 100}%` }} /></div>
      </td>
      <td className="max-w-xs px-3 py-2 text-xs text-muted">{l.reason}</td>
    </tr>
  );
}

type Split = ReturnType<typeof splitByProject>;

function entries(inv: Invoice, split: Split) {
  const rows = split.flatMap(r => [
    { account: `Job cost: ${projectName(r.project)} · materials & tax`, debit: r.materialsCents + r.taxCents, credit: 0 },
    ...(r.feeCents ? [{ account: `Job cost: ${projectName(r.project)} · card surcharge`, debit: r.feeCents, credit: 0 }] : []),
  ]);
  return [...rows, { account: `Accounts payable: ${inv.supplier}`, debit: 0, credit: inv.totalCents }];
}

function Journal({ inv, split }: { inv: Invoice; split: Split }) {
  const rows = entries(inv, split);
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-sm num">
        <thead className="text-left text-muted"><tr className="border-b border-line"><th className="px-3 py-2 font-medium">Account</th><th className="px-3 py-2 text-right font-medium">Debit</th><th className="px-3 py-2 text-right font-medium">Credit</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.account} className="border-b border-line last:border-0"><td className="px-3 py-2">{r.account}</td><td className="px-3 py-2 text-right">{r.debit ? money(r.debit) : ""}</td><td className="px-3 py-2 text-right">{r.credit ? money(r.credit) : ""}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function csv(inv: Invoice, split: Split) {
  const body = ["date,account,debit,credit", ...entries(inv, split).map(r => `${inv.date},"${r.account}",${(r.debit / 100).toFixed(2)},${(r.credit / 100).toFixed(2)}`)].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(body)}`;
}
