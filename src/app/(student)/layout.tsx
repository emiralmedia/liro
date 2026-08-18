import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { isStudent } from "@/lib/authz";
import { getActor } from "@/lib/session";
import { Brand } from "@/components/ui";

/**
 * Poarta spațiului cursantului. Interfața este integral în rusă (brief §2).
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  if (!actor) redirect("/login");
  if (!isStudent(actor)) redirect("/profesor");

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div lang="ru" className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <a href="/cursant"><Brand /></a>
          <form action={logout}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-ink-soft hover:bg-sunken"
            >
              Выйти
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">{children}</main>
    </div>
  );
}
