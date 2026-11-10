import buyer from "@/data/buyer.json";
import invoices from "@/data/invoices.json";
import { acceptGuess, checkInvoice, codeByRules, type Buyer, type Invoice } from "@/lib/settle.ts";
import { extractInvoice, guessLines, LIVE } from "@/lib/llm.ts";

const b = buyer as Buyer;

export async function POST(req: Request) {
  const { id } = await req.json();
  const seed = (invoices as Invoice[]).find(i => i.id === id);
  if (!seed) return Response.json({ error: "Unknown invoice" }, { status: 404 });
  try {
    const inv = await extractInvoice(seed);
    const errors = checkInvoice(inv);
    if (errors.length) return Response.json({ error: "Extracted invoice doesn't reconcile", errors }, { status: 422 });
    const ruled = inv.lines.map(l => codeByRules(l, b));
    const guesses = await guessLines(inv, inv.lines.filter((_, i) => !ruled[i]), b);
    const lines = inv.lines.map((l, i) => ruled[i] ?? acceptGuess(l, guesses[l.n] ?? { project: null, costCode: null, confidence: 0, reason: "No model answer for this line" }, b));
    return Response.json({ invoice: inv, lines, live: LIVE });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
