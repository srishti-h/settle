// Renders src/data/invoices.json into public/invoices/*.pdf with headless Chrome.
// Usage: node scripts/make-pdfs.mjs   (set CHROME=/path/to/chrome if not on macOS)
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const invoices = JSON.parse(readFileSync("src/data/invoices.json", "utf8"));
const $ = c => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const tmp = mkdtempSync(path.join(tmpdir(), "settle-"));

for (const inv of invoices) {
  const rows = inv.lines.map(l => `<tr><td>${l.sku}</td><td>${l.description}${l.po ? `<br><small>Cust PO ${l.po}</small>` : ""}</td><td>${l.qty} ${l.uom}</td><td>${$(l.unitCents)}</td><td>${l.taxable ? "" : "NT"}</td><td>${$(l.amountCents)}</td></tr>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{font:12px Helvetica,Arial,sans-serif;margin:40px;color:#222} h1{font-size:22px;margin:0}
    table{width:100%;border-collapse:collapse;margin-top:24px} th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}
    td:nth-child(n+3),th:nth-child(n+3){text-align:right} .tot td{border:0} .tot td:last-child{font-weight:bold}
    .row{display:flex;justify-content:space-between} small{color:#777}</style>
    <div class="row"><div><h1>VOLT SUPPLY CO.</h1>Electrical Distribution · 2100 Industrial Way, Oakland CA</div>
    <div style="text-align:right"><b>INVOICE ${inv.id}</b><br>Date ${inv.date}<br>Terms: Net 30</div></div>
    <p><b>Bill to:</b> ${inv.buyer}, Accounts Payable</p>
    <table><tr><th>Item</th><th>Description</th><th>Qty</th><th>Unit</th><th>Tax</th><th>Amount</th></tr>${rows}
    <tr class="tot"><td colspan=5>Subtotal</td><td>${$(inv.subtotalCents)}</td></tr>
    <tr class="tot"><td colspan=5>Sales tax</td><td>${inv.taxCents ? $(inv.taxCents) : "incl."}</td></tr>
    <tr class="tot"><td colspan=5>Card payment surcharge (3%)</td><td>${$(inv.surchargeCents)}</td></tr>
    <tr class="tot"><td colspan=5>TOTAL DUE</td><td>${$(inv.totalCents)}</td></tr></table>
    <p><small>NT = non-taxable. Card payments subject to 3% surcharge. Remit ACH to acct ending 4471.</small></p>`;
  const file = path.join(tmp, `${inv.id}.html`);
  writeFileSync(file, html);
  execFileSync(chrome, ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${path.resolve("public/invoices", inv.id + ".pdf")}`, `file://${file}`], { stdio: "ignore" });
  console.log("wrote", `public/invoices/${inv.id}.pdf`);
}
