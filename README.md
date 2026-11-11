# Settle

**Split Decision · BBS × Ramp Hackathon, Round 2**
Srishti Hazra · Riya Pallikonda · Anagha Taneja

**Live demo:** https://settle-amber.vercel.app

One structured invoice that fixes both sides of a B2B card payment:

- **Buyers** stop splitting supplier invoices across projects by hand in spreadsheets. Settle codes every line to a project and cost code, explains why, and spreads tax and card surcharges across projects so job costs are right.
- **Suppliers** stop choosing between "absorb card fees on everyone" and "surcharge everyone." The same line items travel with the card payment (the data card networks increasingly require for lower commercial rates), and Settle picks a card policy *per customer* that's checked against state surcharge law.

## The outdated workflow

1. A supplier sends a PDF invoice covering several of the buyer's projects, with one blanket card surcharge.
2. The buyer's AP team splits each line across projects in Excel and re-keys it into the accounting system. The surcharge gets dumped into overhead.
3. The card payment carries no line-item detail, so the supplier pays the standard rate.
4. Every customer gets the same surcharge, including loyal accounts and states where surcharging is banned.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # logic tests (Node's built-in runner)
```

Optional: `ANTHROPIC_API_KEY=sk-... npm run dev` switches extraction, line coding and customer emails to live Claude calls. Without a key, the app runs in **demo mode**: PO and history matching, all money math and the strategy engine still run for real, and the model's answers for the hero invoice come from `src/data/model_fixtures.json` (hand-written, same schema as the live call). The UI says which mode it's in.

`node scripts/make-pdfs.mjs` regenerates the invoice PDFs from `src/data/invoices.json`.

## How it works

```
PDF ──► extract (Claude, PDF in → typed lines) ──► reconcile totals ──► code each line
                                                                           │
            tier 1: PO match / consistent SKU history (plain code, no AI) ─┤
            tier 2: Claude with past coding, POs, timesheets ──────────────┤
            < 70% confidence → a person confirms ──────────────────────────┘
                                   │
          ┌────────────────────────┴─────────────────────────┐
   buyer: split tax + surcharge by project,        supplier: line-item payload for the
   journal entries, CSV export                     card payment + per-account policy
```

| File | What |
|---|---|
| `src/lib/settle.ts` | All business logic, pure functions: reconciliation, tiered coding, allocation, payload, strategy engine |
| `src/lib/settle.test.ts` | Tests for the money math, coding tiers, model-output guard and strategy outcomes |
| `src/lib/llm.ts` | The only file that calls Claude (extraction, line coding, customer email) |
| `src/app/api/*` | Two routes: `/api/settle` (run an invoice), `/api/message` (draft an email) |
| `src/app/page.tsx`, `logo.tsx` | Landing page and logo (one line forking into three projects) |
| `src/app/invoices` | Buyer inbox |
| `src/app/invoice/[id]` | Buyer + supplier view of one invoice |
| `src/app/supplier` | Supplier's card policy for every customer account |
| `src/data/*.json` | Seed data: projects, POs, timesheets, coding history, accounts, state rules |

## Decisions, and why

**Deterministic first, model second.** A line that matches a PO, or a SKU that has always gone to the same project, doesn't need an LLM. Plain code handles those (`codeByRules`). The model only sees lines a person would have had to think about. That's cheaper, faster and easier to audit, and in the demo 3 of 7 lines never touch the model.

**The model has to show its work, and it doesn't get the last word.** Every line has a `reason` that cites the evidence (a PO, a timesheet, past coding). Anything under 70% confidence goes to a person, and approval is blocked until it's confirmed. If the model names a project or cost code that doesn't exist, `acceptGuess` throws the answer out instead of posting it.

**No trained model, on purpose.** We have no real coding data, and a model trained on fake data would be theater. Retrieval (similar past lines, open POs, this week's timesheets) plus an LLM gets the "learns from your history" behavior without a training pipeline. Once real data exists, accuracy is measurable against held-out coding history.

**Totals must reconcile before anything else happens.** PDF extraction is a trust boundary. `checkInvoice` requires qty × unit = line amount for every line, and subtotal + tax + surcharge = total. If extraction is off by a cent, the invoice is rejected with the reason instead of being posted wrong.

**Money is integer cents, split with largest-remainder rounding.** Spreading a $547.03 surcharge over three projects by naive rounding can be off by a cent. `allocate` always sums exactly to the original amount, and the test checks it. Tax spreads only over taxable lines; the surcharge spreads over everything.

**Forced tool calls instead of parsing text.** Every Claude call uses `tool_choice` with a JSON schema, so output arrives typed. No regex over prose.

**The strategy engine is a formula you can read, not a black box.** Each customer gets four options (surcharge, absorb, ACH discount, waive the fee for faster payment), each scored as annual net value: fees recovered, minus fees paid, minus *expected lost lifetime value* (churn probability × LTV), plus the cash value of faster payment. Price sensitivity uses a few hand-tuned weights (competitor nearby, falling orders, tenure), and the code labels them as a shortcut. A supplier can see exactly why an account got its policy, which matters more than a slightly better guess.

**Compliance is a lookup table, not RAG.** There are fewer than 60 jurisdictions, and a wrong answer means breaking the law. A small hand-checked table (`rules.json`) with source links beats retrieving from documents and hoping. States where our sources conflict are marked `unclear`, and **Settle never auto-surcharges there**. The card network cap (3%, the lower of Visa's and Mastercard's) applies everywhere.

**No database, no auth, no payment rails.** None of them would change what a judge sees. Seed data is JSON in the repo, and demo state resets on refresh. Settle generates the line-item payload a card payment would carry rather than integrating a processor.

**One Next.js app.** UI and API in one repo, one deploy, one live URL. Tailwind for styling, no component library. The only runtime dependencies are Next and React; Claude is called with `fetch`.

## Honest limits

- **Card rates are illustrative** (2.9% standard vs 2.4% with complete data). Real rates vary by card type, processor and data quality. Visa moved to a validated enhanced-data program in 2025–26, and Mastercard still uses Level 2/3.
- **State rules** were checked against public 2026 guides on Nov 10, 2026, and are not legal advice. Each row links its source.
- **Churn weights are hand-tuned**, not fit to data.
- **Demo mode's model answers are fixtures.** Set a key to see live answers.

## Roadmap

1. Measure coding accuracy on real history (held-out split), and tune the review threshold to it.
2. Push journal entries into QuickBooks Online / NetSuite instead of CSV.
3. Send the line-item payload through a processor that supports enhanced data.
4. Fit churn and price sensitivity on real account history.
5. Close the loop: when the buyer pays early or by ACH, the supplier's terms update automatically.
