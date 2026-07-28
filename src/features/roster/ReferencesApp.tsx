"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPanel } from "./components/admin-panel";
import type { Snapshot } from "./types";

export function ReferencesApp({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  return (
    <AdminPanel
      open
      layout="page"
      snapshot={snapshot}
      onClose={() => router.replace("/")}
      onSaved={setSnapshot}
    />
  );
}
