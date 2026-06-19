import { Studio } from "@/components/Studio";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          MiroFish <span className="text-violet-400">Studio</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Simulation multi-agents de la réception marché d'un lancement — cadrage cabinet de conseil.
        </p>
      </header>
      <Studio />
    </main>
  );
}
