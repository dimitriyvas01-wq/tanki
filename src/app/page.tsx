import { Logo } from "@/components/logo";

export default function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero */}
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-2xl space-y-6 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Шаблон Next.js готов к работе
          </h1>
          <p className="text-lg text-muted-foreground">
            Воплотите идею в готовое веб-приложение!
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mb-4 flex items-center justify-center">
        <div className="flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-neutral-100">
          <Logo className="h-5 w-auto" />
        </div>
      </footer>
    </div>
  );
}
