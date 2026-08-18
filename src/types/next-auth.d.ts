import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/authz";

/**
 * Extinde sesiunea Auth.js cu câmpurile de care depinde autorizarea.
 * Fără asta, `session.user.role` ar fi `any` și verificările de rol ar trece
 * tăcut de compilator.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      locale: string;
      isActive: boolean;
    } & DefaultSession["user"];
  }
}
