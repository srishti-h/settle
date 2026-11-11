import Link from "next/link";
import invoices from "@/data/invoices.json";
import buyer from "@/data/buyer.json";
import { money } from "@/lib/settle.ts";

export default function Inbox() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{buyer.company}: invoices to code</h1>
        <p className="mt-1 text-sm text-muted">Supplier invoices that cover several projects. Settle reads each one, codes every line, and splits fees across projects.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">Invoice</th><th className="px-4 py-2 font-medium">Supplier</th>
              <th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Lines</th>
              <th className="px-4 py-2 text-right font-medium">Total</th><th />
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{inv.id}</td><td className="px-4 py-3">{inv.supplier}</td>
                <td className="px-4 py-3 num">{inv.date}</td><td className="px-4 py-3 num">{inv.lines.length}</td>
                <td className="px-4 py-3 text-right num">{money(inv.totalCents)}</td>
                <td className="px-4 py-3 text-right"><Link href={`/invoice/${inv.id}`} className="font-medium text-accent hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
