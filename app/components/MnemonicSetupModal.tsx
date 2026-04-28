"use client";

import { useState } from "react";
import { generateMnemonic } from "../lib/mnemonic";

type Props = {
  /** Returns null on success or an error string on failure */
  onSetup: (mnemonic: string) => Promise<string | null>;
};

export function MnemonicSetupModal({ onSetup }: Props) {
  const [tab, setTab] = useState<"generate" | "restore">("generate");
  const [mnemonic, setMnemonic] = useState(() => generateMnemonic());
  const [confirmed, setConfirmed] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!confirmed) return;
    setLoading(true);
    setError("");
    const err = await onSetup(mnemonic);
    if (err) setError(err);
    setLoading(false);
  };

  const handleRestore = async () => {
    const phrase = restoreInput.trim();
    if (!phrase) { setError("Please enter your secret phrase."); return; }
    setLoading(true);
    setError("");
    const err = await onSetup(phrase);
    if (err) setError(err);
    setLoading(false);
  };

  const refreshMnemonic = () => {
    setMnemonic(generateMnemonic());
    setConfirmed(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-tg-bg shadow-2xl">
        {/* Header */}
        <div className="border-b border-tg-border px-6 py-4">
          <h2 className="text-base font-semibold">Set Up Encryption Keys</h2>
          <p className="mt-0.5 text-xs text-tg-text-secondary">
            Your messages are end-to-end encrypted. A secret phrase protects your private key.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-tg-border">
          <button
            type="button"
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              tab === "generate"
                ? "border-b-2 border-tg-accent text-tg-accent"
                : "text-tg-text-secondary hover:text-tg-text"
            }`}
            onClick={() => { setTab("generate"); setError(""); }}
          >
            New phrase
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 text-sm font-medium transition ${
              tab === "restore"
                ? "border-b-2 border-tg-accent text-tg-accent"
                : "text-tg-text-secondary hover:text-tg-text"
            }`}
            onClick={() => { setTab("restore"); setError(""); }}
          >
            Restore
          </button>
        </div>

        <div className="px-6 py-5">
          {tab === "generate" ? (
            <div className="space-y-4">
              <p className="text-xs text-tg-text-secondary">
                Write down these 12 words in order and keep them safe. You will need them to access your messages on a new device.
              </p>

              {/* Word grid */}
              <div className="grid grid-cols-3 gap-2">
                {mnemonic.split(" ").map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg bg-tg-panel px-2.5 py-1.5"
                  >
                    <span className="w-4 text-right text-[10px] text-tg-text-muted">{i + 1}</span>
                    <span className="text-sm font-medium">{word}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={refreshMnemonic}
                className="flex items-center gap-1.5 text-xs text-tg-text-secondary hover:text-tg-accent"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <path d="M17.65 6.35A8 8 0 0 0 6.34 17.66l1.42-1.42A6 6 0 1 1 18 12h-3l4 4 4-4h-3a8 8 0 0 0-2.35-5.65z" />
                </svg>
                Generate new phrase
              </button>

              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="h-4 w-4 accent-tg-accent"
                />
                I have written down my secret phrase
              </label>

              {error && <p className="text-xs text-tg-danger">{error}</p>}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!confirmed || loading}
                className="w-full rounded-lg bg-tg-accent py-2.5 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-40"
              >
                {loading ? "Setting up…" : "Continue"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-tg-text-secondary">
                Enter your 12-word secret phrase to restore your encryption keys on this device.
              </p>
              <textarea
                className="w-full rounded-lg border border-tg-border bg-tg-panel px-3 py-2 text-sm placeholder:text-tg-text-muted focus:border-tg-accent focus:outline-none"
                rows={3}
                placeholder="word1 word2 word3 …"
                value={restoreInput}
                onChange={(e) => setRestoreInput(e.target.value)}
                autoFocus
              />
              {error && <p className="text-xs text-tg-danger">{error}</p>}
              <button
                type="button"
                onClick={handleRestore}
                disabled={!restoreInput.trim() || loading}
                className="w-full rounded-lg bg-tg-accent py-2.5 text-sm font-medium text-white transition hover:bg-tg-accent-hover disabled:opacity-40"
              >
                {loading ? "Restoring…" : "Restore keys"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
