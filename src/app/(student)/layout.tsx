import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { isStudent } from "@/lib/authz";
import { getActor } from "@/lib/session";

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
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <span className="font-semibold">Liro</span>
          <form action={logout}>
            <button type="submit" className="min-h-11 px-3 text-sm text-stone-600 underline">
              Выйти
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6">{children}</main>
    </div>
  );
}
