import { auth } from "@/lib/auth";
import type { Actor } from "@/lib/authz";

/**
 * Puntea între sesiunea Auth.js și `Actor`, tipul pe care îl înțelege stratul
 * de autorizare. Toate paginile și server actions pornesc de aici.
 */
export async function getActor(): Promise<Actor | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    userId: session.user.id,
    role: session.user.role,
    isActive: session.user.isActive,
  };
}

/** Ruta implicită după autentificare, în funcție de rol. */
export function homePathFor(actor: Actor): string {
  switch (actor.role) {
    case "teacher":
      return "/profesor";
    case "admin":
      return "/admin";
    case "student":
      return "/cursant";
  }
}
