"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";

type Status = "idle" | "guest-loading" | "email-loading" | "email-sent";

export default function SignInPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Guest-first (onboarding §5): no account needed to score a round.
  async function continueAsGuest() {
    setError(null);
    setStatus("guest-loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    router.push("/");
    router.refresh();
  }

  // Email = passwordless magic link (no Apple/Google in Phase 0).
  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("email-loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setStatus("email-sent");
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 py-10">
      <header className="text-center">
        <p className="eyebrow">Autocaddie</p>
        <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9]">
          Pick a game.
          <br />
          Keep score.
          <br />
          Settle <span className="text-flare">up.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-[40ch] text-sm text-muted">
          Play golf games with your group. No account needed to start.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={continueAsGuest}
          disabled={status === "guest-loading"}
          className="font-label flex items-center justify-center gap-2 rounded-md bg-flare px-6 py-4 text-sm font-bold uppercase tracking-[0.07em] text-white transition active:translate-y-px disabled:opacity-70"
        >
          {status === "guest-loading" && (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          )}
          Start playing
        </button>

        <div className="flex items-center gap-3 text-muted">
          <span className="h-px flex-1 bg-line" />
          <span className="font-label text-[11px] uppercase tracking-[0.12em]">
            or use email
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {status === "email-sent" ? (
          <div className="rounded-md border border-line bg-card p-4 text-center text-sm shadow-card">
            <Mail className="mx-auto mb-2 size-5 text-fairway" aria-hidden />
            Check <b>{email}</b> for a sign-in link.
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-line bg-field px-4 py-3.5 text-base text-text outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={status === "email-loading"}
              className="font-label flex items-center justify-center gap-2 rounded-md border border-line bg-card px-6 py-3.5 text-sm font-bold uppercase tracking-[0.07em] text-text transition active:translate-y-px disabled:opacity-70"
            >
              {status === "email-loading" && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Send magic link
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-center text-sm text-down">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
