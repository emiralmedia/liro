import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { isAdmin, isTeacher } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Poarta spațiului profesorului. Verificarea se face aici, server-side, nu
 * prin ascunderea linkurilor: o rută de sub acest layout nu poate fi atinsă
 * de un cursant nici dacă îi ghicește adresa.
 */
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  if (!actor) redirect("/login");
  if (!isTeacher(actor) && !isAdmin(actor)) redirect("/cursant");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div lang="ro" className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[--color-line] bg-[--color-surface]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          <a href="/profesor" className="font-semibold tracking-tight">
            Liro
          </a>
          <nav aria-label="Principal" className="flex items-center gap-1 text-sm">
            <a
              href="/profesor"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-[--color-ink-soft] hover:bg-[--color-sunken] hover:text-[--color-ink]"
            >
              Astăzi
            </a>
            <a
              href="/profesor/revizuire"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-[--color-ink-soft] hover:bg-[--color-sunken] hover:text-[--color-ink]"
            >
              De revizuit
            </a>
          </nav>
          <form action={logout} className="ml-auto">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-[--color-ink-soft] hover:bg-[--color-sunken]"
            >
              Ieșire
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
