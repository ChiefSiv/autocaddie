"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/auth/use-user";

// Set-new-password after a recovery link. /auth/callback exchanges the recovery
// code into a session BEFORE routing here, so by the time this loads the user has
// a (recovery) session and updateUser({ password }) works — including setting a
// password for the FIRST time on an account created via magic link (not a
// duplicate signup).
export default function ResetPasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useUser();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    // Password set → the recovery session is now a full session. Land on Home.
    await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 py-10">
      <header className="text-center">
        <p className="eyebrow">Autocaddie</p>
        <h1 className="font-display mt-2 text-4xl font-extrabold uppercase leading-[0.95]">
          Set a new
          <br />
          password
        </h1>
      </header>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-field" aria-hidden />
      ) : !user ? (
        <div className="rounded-md border border-line bg-card p-4 text-center text-sm shadow-card">
          <p className="text-muted">
            This reset link is invalid or has expired.
          </p>
          <Link href="/signin" className="mt-3 inline-block font-label text-sm text-fairway">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <p className="text-center text-sm text-muted">
            Setting a password for <b>{user.email}</b>.
          </p>
          <label htmlFor="password" className="sr-only">New password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-line bg-field px-4 py-3.5 text-base text-text outline-none placeholder:text-muted focus:border-fairway"
          />
          <label htmlFor="confirm" className="sr-only">Confirm password</label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-line bg-field px-4 py-3.5 text-base text-text outline-none placeholder:text-muted focus:border-fairway"
          />
          <button
            type="submit"
            disabled={status === "saving"}
            className="font-label flex items-center justify-center gap-2 rounded-md bg-fairway px-6 py-3.5 text-sm font-bold uppercase tracking-[0.07em] text-white transition active:translate-y-px disabled:opacity-70"
          >
            {status === "saving" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Set password &amp; sign in
          </button>
          {error && <p role="alert" className="text-center text-sm text-down">{error}</p>}
        </form>
      )}
    </main>
  );
}
