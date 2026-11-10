import supplier from "@/data/supplier.json";
import rules from "@/data/rules.json";
import { pct, RATES, recommend, type Account, type Rule } from "@/lib/settle.ts";
import Draft from "./draft";

const usd = (x: number) => `${x < 0 ? "−" : ""}$${Math.round(Math.abs(x)).toLocaleString("en-US")}`;
const RULE_TONE = { allowed: "bg-accent-soft text-accent", capped: "bg-warn-soft text-warn", banned: "bg-bad-soft text-bad", unclear: "bg-warn-soft text-warn" };

export default function SupplierPage() {
  const rows = (supplier.accounts as Account[]).map(a => {
    const rule = (rules.states as Record<string, Rule>)[a.state];
    return { a, rule, ...recommend(a, rule, rules.networkCapPct) };
  });
  const blanket = rows.reduce((t, r) => t + r.options.find(o => o.kind === "surcharge")!.annualValue, 0);
  const settle = rows.reduce((t, r) => t + r.pick.annualValue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{supplier.company}: card policy by account</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Instead of one blanket {pct(supplier.blanketSurchargePct)} surcharge, Settle weighs each customer’s card fees against margin, lifetime value, payment speed and churn risk, then checks the option against state law and card network caps.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Blanket surcharge, everyone (annual net)" value={usd(blanket)} />
        <Stat label="Settle, per account (annual net)" value={usd(settle)} />
        <Stat label="Difference" value={usd(settle - blanket)} accent />
      </div>
      <p className="text-xs text-muted">Net = card fees recovered minus fees paid and expected lost lifetime value, at the {pct(RATES.enhanced)} enhanced-data rate. The blanket line ignores state law, which is part of the problem.</p>

      <div className="space-y-2">
        {rows.map(({ a, rule, options, pick, blocked, sensitivity, ltv }) => (
          <details key={a.id} className="group rounded-lg border border-line bg-surface">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span className="w-56 font-medium">{a.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs ${RULE_TONE[rule?.surcharge ?? "unclear"]}`}>{a.state} · surcharge {rule?.surcharge ?? "unclear"}</span>
              <span className="flex-1"><strong>{pick.label}</strong></span>
              <span className="text-xs text-muted num">${a.monthlyRevenue.toLocaleString()}/mo · {Math.round(a.cardShare * 100)}% card</span>
            </summary>
            <div className="space-y-3 border-t border-line px-4 py-3 text-sm">
              <p>{pick.why}.{blocked && <span className="text-warn"> Ruled out: {blocked.label}. {blocked.why}.</span>}</p>
              <p className="text-xs text-muted num">Lifetime value {usd(ltv)} · price sensitivity {Math.round(sensitivity * 100)}% · pays in {a.avgDaysToPay} days · {a.tenureMonths} months as a customer{rule?.note ? ` · ${rule.note}` : ""}</p>
              <table className="w-full text-sm num">
                <thead className="text-left text-muted"><tr><th className="py-1 font-medium">Option</th><th className="py-1 text-right font-medium">Annual net</th><th className="py-1 pl-4 font-medium">Why</th></tr></thead>
                <tbody>
                  {options.map(o => (
                    <tr key={o.kind} className={o === pick ? "font-medium" : o.allowed ? "" : "text-muted line-through decoration-muted/50"}>
                      <td className="py-1">{o === pick ? "→ " : ""}{o.label}</td><td className="py-1 text-right">{usd(o.annualValue)}</td><td className="py-1 pl-4 text-xs">{o.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rule && <p className="text-xs text-muted">Sources: {rule.sources.map((s, i) => <a key={s} href={s} target="_blank" className="underline">[{i + 1}]</a>)} · {rules.networkSource}</p>}
              <Draft id={a.id} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border border-line p-3 ${accent ? "bg-accent-soft" : "bg-surface"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold num ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}
