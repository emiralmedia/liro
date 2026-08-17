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
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold">Liro · profesor</span>
          <form action={logout}>
            <button type="submit" className="min-h-11 px-3 text-sm text-stone-600 underline">
              Ieșire
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
