import supplier from "@/data/supplier.json";
import rules from "@/data/rules.json";
import { recommend, type Account, type Rule } from "@/lib/settle.ts";
import { draftMessage } from "@/lib/llm.ts";

export async function POST(req: Request) {
  const { id } = await req.json();
  const a = (supplier.accounts as Account[]).find(x => x.id === id);
  if (!a) return Response.json({ error: "Unknown account" }, { status: 404 });
  const { pick } = recommend(a, (rules.states as Record<string, Rule>)[a.state], rules.networkCapPct);
  try {
    return Response.json(await draftMessage(a.name, supplier.company, pick.label, pick.why));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
