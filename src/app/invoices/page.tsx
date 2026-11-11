import Link from "next/link";
import invoices from "@/data/invoices.json";
import buyer from "@/data/buyer.json";
import { money } from "@/lib/settle.ts";

const TONE: Record<string, string> = { "Needs coding": "bg-warn-soft text-warn", New: "bg-lime text-ink", Posted: "bg-accent-soft text-accent" };

export default function Inbox() {
  const open = invoices.filter(i => i.status !== "Posted");
  const stats = [
    { label: "Open invoices", value: String(open.length) },
    { label: "Waiting to be coded", value: money(open.reduce((a, i) => a + i.totalCents, 0)) },
    { label: "Lines to code", value: String(open.reduce((a, i) => a + i.lines.length, 0)) },
    { label: "Card surcharges to allocate", value: money(open.reduce((a, i) => a + i.surchargeCents, 0)) },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{buyer.company}: supplier invoices</h1>
        <p className="mt-1 text-sm text-muted">Invoices that cover several projects. Open one and Settle codes every line, then splits tax and card fees across projects.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-xs text-muted">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight num">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Items</th><th className="px-4 py-3 text-right font-medium">Total</th><th />
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-b border-line last:border-0 hover:bg-bg">
                <td className="whitespace-nowrap px-4 py-3 font-medium">{inv.id}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[inv.status]}`}>{inv.status}</span></td>
                <td className="whitespace-nowrap px-4 py-3">{inv.supplier}</td>
                <td className="whitespace-nowrap px-4 py-3 num">{inv.date}</td>
                <td className="max-w-xs px-4 py-3 text-muted"><span className="line-clamp-1">{inv.lines.map(l => l.description.split(",")[0]).join(" · ")}</span></td>
                <td className="px-4 py-3 text-right num">{money(inv.totalCents)}</td>
                <td className="px-4 py-3 text-right"><Link href={`/invoice/${inv.id}`} className="whitespace-nowrap font-medium underline decoration-lime decoration-4 underline-offset-4 hover:decoration-ink">{inv.status === "Posted" ? "Review" : "Code it"} →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
