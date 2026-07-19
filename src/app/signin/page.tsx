"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";

type Mode = "password" | "magic";
type Status =
  | "idle"
  | "guest-loading"
  | "signin-loading"
  | "signup-loading"
  | "magic-loading"
  | "magic-sent"
  | "confirm-sent"
  | "reset-loading"
  | "reset-sent";

export default function SignInPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("password");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status.endsWith("-loading");

  async function afterSession() {
    await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    router.push("/");
    router.refresh();
  }

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
    await afterSession();
  }

  // Email + password sign-in.
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("signin-loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    await afterSession();
  }

  // Create an account with email + password. If "Confirm email" is on in Supabase,
  // no session comes back yet → prompt to confirm; otherwise sign straight in.
  async function signUp() {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setStatus("signup-loading");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    if (data.session) {
      await afterSession();
      return;
    }
    setStatus("confirm-sent"); // confirmation required
  }

  // Forgot password → email a recovery link that lands on /auth/reset-password.
  // Works for an account that has no password yet (e.g. created via magic link):
  // the recovery session lets updateUser({ password }) set one.
  async function sendReset() {
    setError(null);
    if (!email) {
      setError("Enter your email first, then tap “Forgot password?”");
      return;
    }
    setStatus("reset-loading");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/auth/reset-password`,
    });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setStatus("reset-sent");
  }

  // Passwordless magic link — kept as an alternative.
  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("magic-loading");
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
    setStatus("magic-sent");
  }

  const emailInput = (
    <div>
      <label htmlFor="email" className="sr-only">Email address</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-line bg-field px-4 py-3.5 text-base text-text outline-none placeholder:text-muted focus:border-fairway"
      />
    </div>
  );

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
          disabled={busy}
          className="font-label flex items-center justify-center gap-2 rounded-md bg-flare px-6 py-4 text-sm font-bold uppercase tracking-[0.07em] text-white transition active:translate-y-px disabled:opacity-70"
        >
          {status === "guest-loading" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Start playing
        </button>

        <div className="flex items-center gap-3 text-muted">
          <span className="h-px flex-1 bg-line" />
          <span className="font-label text-[11px] uppercase tracking-[0.12em]">or use email</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {status === "magic-sent" ? (
          <div className="rounded-md border border-line bg-card p-4 text-center text-sm shadow-card">
            <Mail className="mx-auto mb-2 size-5 text-fairway" aria-hidden />
            Check <b>{email}</b> for a sign-in link.
          </div>
        ) : status === "reset-sent" ? (
          <div className="rounded-md border border-line bg-card p-4 text-center text-sm shadow-card">
            <Mail className="mx-auto mb-2 size-5 text-fairway" aria-hidden />
            Check <b>{email}</b> for a link to set a new password.
          </div>
        ) : status === "confirm-sent" ? (
          <div className="rounded-md border border-line bg-card p-4 text-center text-sm shadow-card">
            <Mail className="mx-auto mb-2 size-5 text-fairway" aria-hidden />
            Account created — check <b>{email}</b> to confirm, then sign in.
          </div>
        ) : mode === "password" ? (
          <form onSubmit={signIn} className="flex flex-col gap-3">
            {emailInput}
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-line bg-field px-4 py-3.5 text-base text-text outline-none placeholder:text-muted focus:border-fairway"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="font-label flex flex-1 items-center justify-center gap-2 rounded-md bg-fairway px-6 py-3.5 text-sm font-bold uppercase tracking-[0.07em] text-white transition active:translate-y-px disabled:opacity-70"
              >
                {status === "signin-loading" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Sign in
              </button>
              <button
                type="button"
                onClick={signUp}
                disabled={busy}
                className="font-label flex flex-1 items-center justify-center gap-2 rounded-md border border-line bg-card px-6 py-3.5 text-sm font-bold uppercase tracking-[0.07em] text-text transition active:translate-y-px disabled:opacity-70"
              >
                {status === "signup-loading" && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Create account
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setMode("magic"); setError(null); }}
                className="font-label text-[11px] uppercase tracking-[0.08em] text-muted underline-offset-2 hover:underline"
              >
                Magic link instead
              </button>
              <button
                type="button"
                onClick={sendReset}
                disabled={busy}
                className="font-label text-[11px] uppercase tracking-[0.08em] text-muted underline-offset-2 hover:underline disabled:opacity-70"
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
            {emailInput}
            <button
              type="submit"
              disabled={busy}
              className="font-label flex items-center justify-center gap-2 rounded-md border border-line bg-card px-6 py-3.5 text-sm font-bold uppercase tracking-[0.07em] text-text transition active:translate-y-px disabled:opacity-70"
            >
              {status === "magic-loading" && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Send magic link
            </button>
            <button
              type="button"
              onClick={() => { setMode("password"); setError(null); }}
              className="font-label text-center text-[11px] uppercase tracking-[0.08em] text-muted underline-offset-2 hover:underline"
            >
              Use a password instead
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-center text-sm text-down">{error}</p>
        )}
      </div>
    </main>
  );
}
