import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline — Autocaddie" };

// App-shell offline fallback. Precached by the service worker so it loads with
// no signal. Phase 2 scoring works fully offline against the local store.
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-xl bg-field text-muted">
        <WifiOff className="size-8" aria-hidden />
      </div>
      <div>
        <p className="eyebrow">No connection</p>
        <h1 className="font-display mt-1 text-3xl font-extrabold uppercase">
          You&rsquo;re offline
        </h1>
      </div>
      <p className="max-w-[36ch] text-sm text-muted">
        Autocaddie is built to keep working in dead zones. Your scores stay safe
        on this device and sync the moment you&rsquo;re back online.
      </p>
    </main>
  );
}
