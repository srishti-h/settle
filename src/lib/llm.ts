import { readFile } from "node:fs/promises";
import path from "node:path";
import fixtures from "@/data/model_fixtures.json";
import type { Buyer, Guess, Invoice, Line } from "./settle.ts";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5-5";
export const LIVE = Boolean(KEY);

// Tool call = schema-shaped JSON back, no parsing of free text. This model rejects a forced
// tool_choice, so the prompt asks for the call and we fail loudly if it doesn't come.
async function callTool<T>(content: unknown[], tool: { name: string; description: string; input_schema: object }): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4096, tools: [tool], messages: [{ role: "user", content: [...content, { type: "text", text: `Answer only by calling the ${tool.name} tool.` }] }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const call = body.content.find((c: { type: string; name?: string }) => c.type === "tool_use" && c.name === tool.name);
  if (!call) throw new Error(`Model answered without calling ${tool.name}`);
  return call.input as T;
}

const lineSchema = {
  type: "object",
  properties: {
    n: { type: "integer" }, sku: { type: "string" }, description: { type: "string" }, qty: { type: "number" }, uom: { type: "string" },
    unitCents: { type: "integer" }, amountCents: { type: "integer" }, taxable: { type: "boolean" }, po: { type: "string" },
  },
  required: ["n", "sku", "description", "qty", "uom", "unitCents", "amountCents", "taxable"],
};

// Reads the invoice PDF. Without a key, the seed invoice already holds what extraction returns.
export async function extractInvoice(inv: Invoice): Promise<Invoice> {
  if (!LIVE) return inv;
  const pdf = await readFile(path.join(process.cwd(), "public", inv.pdf));
  const out = await callTool<Omit<Invoice, "id" | "pdf" | "supplier" | "buyer" | "date">>(
    [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
      { type: "text", text: "Extract every invoice line and the printed totals. Money in integer cents. A line is taxable unless the invoice marks it non-taxable. Put a PO number on a line only if printed next to it." },
    ],
    {
      name: "record_invoice", description: "Record the invoice exactly as printed.",
      input_schema: { type: "object", properties: { lines: { type: "array", items: lineSchema }, subtotalCents: { type: "integer" }, taxCents: { type: "integer" }, surchargeCents: { type: "integer" }, totalCents: { type: "integer" } }, required: ["lines", "subtotalCents", "taxCents", "surchargeCents", "totalCents"] },
    },
  );
  return { ...inv, ...out };
}

// Tier 2: the model sees what a project accountant would look at, and must explain itself.
export async function guessLines(inv: Invoice, lines: Line[], b: Buyer): Promise<Record<number, Guess>> {
  if (!lines.length) return {};
  if (!LIVE) return Object.fromEntries(lines.map(l => [l.n, (fixtures as unknown as Record<string, Guess>)[`${inv.id}:${l.n}`]]));
  const words = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const similar = (l: Line) => b.history.filter(h => h.sku === l.sku || [...words(h.description)].some(w => words(l.description).has(w))).slice(-10);
  const context = {
    projects: b.projects, costCodes: b.costCodes, openPurchaseOrders: b.purchaseOrders,
    recentTimesheets: b.timesheets, lines: lines.map(l => ({ ...l, similarPastCoding: similar(l) })),
  };
  const out = await callTool<{ guesses: (Guess & { n: number })[] }>(
    [{ type: "text", text: `You code supplier invoice lines to construction projects for ${b.company}. Use past coding, open POs and what each crew is doing this week. Only use active projects and listed cost codes. Confidence below 0.7 means a person should confirm; say what would settle it. Reasons: one or two sentences citing the evidence.\n\n${JSON.stringify(context)}` }],
    {
      name: "code_lines", description: "Assign each line to a project and cost code.",
      input_schema: { type: "object", properties: { guesses: { type: "array", items: { type: "object", properties: { n: { type: "integer" }, project: { type: "string" }, costCode: { type: "string" }, confidence: { type: "number" }, reason: { type: "string" } }, required: ["n", "project", "costCode", "confidence", "reason"] } } }, required: ["guesses"] },
    },
  );
  return Object.fromEntries(out.guesses.map(({ n, ...g }) => [n, g]));
}

export async function draftMessage(account: string, supplier: string, strategy: string, why: string): Promise<{ text: string; live: boolean }> {
  if (!LIVE)
    return { live: false, text: `Hi ${account} team,\n\nWe're updating how we handle card payments, and we wanted to offer you something specific to your account: ${strategy}.\n\nNothing changes about your pricing or service. Reply to this email or call your rep with any questions.\n\nThanks for your business,\n${supplier}` };
  const out = await callTool<{ email: string }>(
    [{ type: "text", text: `Write a short, warm email from ${supplier} (an electrical distributor) to customer ${account} announcing this card-payment arrangement: "${strategy}". Internal reasoning, do not quote numbers from it: ${why}. Under 120 words, plain text, no subject line.` }],
    { name: "email", description: "The email body.", input_schema: { type: "object", properties: { email: { type: "string" } }, required: ["email"] } },
  );
  return { live: true, text: out.email };
}
