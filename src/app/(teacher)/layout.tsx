import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { isAdmin, isTeacher } from "@/lib/authz";
import { getActor } from "@/lib/session";
import { Brand } from "@/components/ui";

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
    <div lang="ro" className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="surface-dark sticky top-0 z-20 flex h-18 items-center px-5 text-white lg:h-screen lg:flex-col lg:items-stretch lg:px-5 lg:py-7">
        <a href="/profesor" className="shrink-0 text-white">
          <Brand />
        </a>
        <nav aria-label="Principal" className="ml-6 flex items-center gap-1 text-sm lg:ml-0 lg:mt-12 lg:flex-col lg:items-stretch lg:gap-2">
            <a
              href="/profesor"
              className="inline-flex min-h-11 items-center rounded-xl px-3.5 font-medium text-white/75 hover:bg-white/10 hover:text-white"
            >
              Astăzi
            </a>
            <a
              href="/profesor/biblioteca"
              className="inline-flex min-h-11 items-center rounded-xl px-3.5 font-medium text-white/75 hover:bg-white/10 hover:text-white"
            >
              Bibliotecă
            </a>
            <a
              href="/profesor/revizuire"
              className="inline-flex min-h-11 items-center rounded-xl px-3.5 font-medium text-white/75 hover:bg-white/10 hover:text-white"
            >
              De revizuit
            </a>
        </nav>
          <form action={logout} className="ml-auto lg:mt-auto lg:ml-0">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm text-white/60 hover:bg-white/10 hover:text-white"
            >
              Ieșire
            </button>
          </form>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
