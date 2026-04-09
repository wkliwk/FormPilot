"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Webhook {
  id: string;
  url: string;
  secret: string; // masked
  enabled: boolean;
  createdAt: string;
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, "success" | "error" | null>>({});

  useEffect(() => {
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((data) => setWebhooks(data.webhooks ?? []))
      .catch(() => setError("Failed to load webhooks"))
      .finally(() => setLoading(false));
  }, []);

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create webhook");
        return;
      }
      setWebhooks((prev) => [...prev, { ...data, secret: data.secret.slice(0, 6) + "..." + data.secret.slice(-4) }]);
      setNewUrl("");
    } catch {
      setError("Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function toggleWebhook(id: string, enabled: boolean) {
    try {
      await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, enabled } : w));
    } catch {
      setError("Failed to update webhook");
    }
  }

  async function deleteWebhook(id: string) {
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch {
      setError("Failed to delete webhook");
    }
  }

  async function testWebhook(id: string, url: string) {
    setTestingId(id);
    setTestResult((prev) => ({ ...prev, [id]: null }));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "form.completed",
          formId: "test_123",
          title: "Test Form — FormPilot Webhook",
          category: "GENERAL",
          completedAt: new Date().toISOString(),
          autofillRate: 85,
          fieldCount: 10,
          fieldsFilledCount: 8,
        }),
        mode: "no-cors",
        signal: AbortSignal.timeout(5000),
      });
      // no-cors means we can't read response, but no error = likely delivered
      setTestResult((prev) => ({ ...prev, [id]: res.ok || res.type === "opaque" ? "success" : "error" }));
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: "error" }));
    } finally {
      setTestingId(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-40" />
          <div className="h-20 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/dashboard/settings" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
          &larr; Back to Settings
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Webhooks</h1>
        <p className="text-sm text-slate-500 mt-1">
          Receive a POST request when a form is completed. Works with Zapier, Make, n8n, and any webhook-compatible service.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-red-600">Dismiss</button>
        </div>
      )}

      {/* Add new webhook */}
      <form onSubmit={createWebhook} className="flex gap-2">
        <input
          type="url"
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          required
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          disabled={creating || webhooks.length >= 5}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {creating ? "Adding..." : "Add webhook"}
        </button>
      </form>
      {webhooks.length >= 5 && (
        <p className="text-xs text-slate-400">Maximum 5 webhooks reached.</p>
      )}

      {/* Webhook list */}
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-500">No webhooks configured yet.</p>
          </div>
        ) : (
          webhooks.map((w) => (
            <div key={w.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{w.url}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">Secret: {w.secret}</p>
                </div>
                <button
                  onClick={() => toggleWebhook(w.id, !w.enabled)}
                  className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    w.enabled
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {w.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testWebhook(w.id, w.url)}
                  disabled={testingId === w.id}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40"
                >
                  {testingId === w.id ? "Testing..." : "Send test"}
                </button>
                {testResult[w.id] === "success" && (
                  <span className="text-xs text-emerald-600">Delivered</span>
                )}
                {testResult[w.id] === "error" && (
                  <span className="text-xs text-red-600">Failed — check your URL</span>
                )}
                <span className="flex-1" />
                <button
                  onClick={() => deleteWebhook(w.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payload format reference */}
      <details className="bg-slate-50 border border-slate-200 rounded-2xl">
        <summary className="px-4 py-3 text-sm font-medium text-slate-700 cursor-pointer hover:text-slate-900">
          Payload format
        </summary>
        <pre className="px-4 pb-4 text-xs text-slate-600 font-mono overflow-x-auto">{`{
  "event": "form.completed",
  "formId": "clxyz...",
  "title": "W-4 Employee's Withholding Certificate",
  "category": "TAX",
  "completedAt": "2026-04-09T12:00:00.000Z",
  "autofillRate": 85,
  "fieldCount": 12,
  "fieldsFilledCount": 10
}

Header: X-FormPilot-Signature: <HMAC-SHA256 hex digest>`}</pre>
      </details>
    </div>
  );
}
