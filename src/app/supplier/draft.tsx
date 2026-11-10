"use client";
import { useState } from "react";

export default function Draft({ id }: { id: string }) {
  const [msg, setMsg] = useState<{ text: string; live: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setBusy(true); setError(null);
    const res = await fetch("/api/message", { method: "POST", body: JSON.stringify({ id }) });
    const body = await res.json();
    setBusy(false);
    if (res.ok) setMsg(body); else setError(body.error);
  }

  return (
    <div className="space-y-2">
      <button onClick={draft} disabled={busy} className="rounded-md border border-line px-3 py-1 text-xs font-medium hover:bg-bg disabled:opacity-50">
        {busy ? "Drafting…" : msg ? "Redraft customer email" : "Draft customer email"}
      </button>
      {error && <p role="alert" className="text-xs text-bad">{error}</p>}
      {msg && (
        <div>
          <pre className="whitespace-pre-wrap rounded bg-bg p-3 font-sans text-sm">{msg.text}</pre>
          {!msg.live && <p className="mt-1 text-xs text-muted">Template draft (no API key set). With a key, Claude writes it in the supplier’s voice.</p>}
        </div>
      )}
    </div>
  );
}
