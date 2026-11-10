import { test } from "node:test";
import assert from "node:assert/strict";
import { allocate, checkInvoice, codeByRules, acceptGuess, splitByProject, enhancedData, recommend, type Buyer, type Invoice, type Coded, type Account, type Rule } from "./settle.ts";
import buyer from "../data/buyer.json" with { type: "json" };
import invoices from "../data/invoices.json" with { type: "json" };
import fixtures from "../data/model_fixtures.json" with { type: "json" };
import supplier from "../data/supplier.json" with { type: "json" };
import rules from "../data/rules.json" with { type: "json" };

const b = buyer as Buyer, [hero, small] = invoices as Invoice[];
const fx = fixtures as unknown as Record<string, Coded>;
const codeAll = (inv: Invoice) => inv.lines.map(l => codeByRules(l, b) ?? acceptGuess(l, fx[`${inv.id}:${l.n}`], b));
const pick = (id: string) => {
  const a = supplier.accounts.find(x => x.id === id) as Account;
  return recommend(a, (rules.states as Record<string, Rule>)[a.state], rules.networkCapPct).pick.kind;
};

test("allocate sums exactly and stays proportional", () => {
  assert.deepEqual(allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.equal(allocate(54703, [3, 7, 11]).reduce((a, x) => a + x), 54703);
  assert.deepEqual(allocate(500, [0, 0]), [0, 0]);
});

test("seed invoices reconcile", () => {
  for (const inv of invoices as Invoice[]) assert.deepEqual(checkInvoice(inv), []);
  assert.match(checkInvoice({ ...hero, subtotalCents: 1 }).join(), /Lines sum/);
});

test("tiers: PO, then history, then model", () => {
  const c = codeAll(hero);
  assert.deepEqual(c.map(l => l.tier), ["po", "history", "po", "model", "model", "model", "model"]);
  assert.deepEqual(c.filter(l => l.review).map(l => l.n), [6, 7]);
});

test("model output naming an unknown project is rejected", () => {
  const g = acceptGuess(hero.lines[3], { project: "MOON", costCode: "26 51 00", confidence: 0.99, reason: "x" }, b);
  assert.equal(g.project, null);
  assert.equal(g.review, true);
});

test("project split adds up to the invoice total", () => {
  const rows = splitByProject(codeAll(hero), hero);
  assert.equal(rows.reduce((a, r) => a + r.totalCents, 0), hero.totalCents);
  assert.equal(rows.reduce((a, r) => a + r.taxCents, 0), hero.taxCents);
});

test("enhanced data flags a missing tax amount", () => {
  assert.equal(enhancedData(hero, codeAll(hero)).qualifies, true);
  assert.deepEqual(enhancedData(small, codeAll(small)).missing, ["tax amount"]);
});

test("strategy differs per account and respects state rules", () => {
  assert.equal(pick("northgate"), "fee_relief");    // big, loyal, slow payer
  assert.equal(pick("ridgeline"), "surcharge");     // small, new, insensitive, allowed state
  assert.equal(pick("pacific-solar"), "ach_discount"); // card-heavy, price-sensitive
  assert.notEqual(pick("harbor-mech"), "surcharge"); // banned in CT
  assert.notEqual(pick("empire"), "surcharge");      // unclear in NY: never auto-surcharge
});
