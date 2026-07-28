import { Loader } from "@/components/loader";

export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg-base p-6 text-text-primary">
      <Loader />
    </main>
  );
}


