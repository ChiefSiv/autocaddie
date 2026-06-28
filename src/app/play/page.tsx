import { AppHeader } from "@/components/nav/app-header";
import { AuthGate } from "@/components/auth/auth-gate";
import { RoundSetup } from "@/components/setup/round-setup";

export const metadata = { title: "Set up a round — Autocaddie" };

export default function PlayPage() {
  return (
    <>
      <AppHeader />
      <AuthGate>
        <RoundSetup />
      </AuthGate>
    </>
  );
}
