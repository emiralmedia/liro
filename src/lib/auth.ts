import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

/**
 * Autentificare prin magic link.
 *
 * Nu stocăm parole: pentru o platformă cu conturi de minori, o parolă în plus
 * e o răspundere în plus. Linkul de acces se trimite pe email și expiră.
 *
 * În dezvoltare linkul se scrie în consolă în loc să fie trimis — nu e nevoie
 * de SMTP ca să lucrezi local. În producție, `AUTH_RESEND_KEY` comută pe
 * trimitere reală.
 */

const isProduction = process.env.NODE_ENV === "production";

async function sendMagicLink({ identifier, url }: { identifier: string; url: string }) {
  const resendKey = process.env.AUTH_RESEND_KEY;

  if (!resendKey) {
    if (isProduction) {
      throw new Error("AUTH_RESEND_KEY lipsește: nu pot trimite linkul de autentificare.");
    }
    console.log(`\n  Link de autentificare pentru ${identifier}:\n  ${url}\n`);

    // Auth.js păstrează în baza de date tokenul hash-uit, deci un test nu poate
    // reconstrui linkul din `verification_tokens`. Când AUTH_DEV_LINK_FILE este
    // setat (doar în E2E), scriem linkul într-un fișier pe care testul îl
    // citește. Nu se activează niciodată în producție: ramura asta e deja după
    // verificarea `isProduction` de mai sus.
    const sink = process.env.AUTH_DEV_LINK_FILE;
    if (sink) {
      const { appendFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      // Directorul e gitignorat, deci pe o mașină curată (CI) nu există încă.
      await mkdir(dirname(sink), { recursive: true });
      await appendFile(sink, `${identifier}\t${url}\n`, "utf8");
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM ?? "noreply@example.com",
      to: identifier,
      subject: "Acces Liro / Вход в Liro",
      html:
        `<p>Deschide linkul ca să intri în Liro. Expiră în 24 de ore.</p>` +
        `<p>Откройте ссылку, чтобы войти. Действительна 24 часа.</p>` +
        `<p><a href="${url}">${url}</a></p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Trimiterea emailului a eșuat: ${response.status}`);
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verifica",
  },
  providers: [
    {
      id: "email",
      type: "email",
      name: "Email",
      from: process.env.AUTH_EMAIL_FROM ?? "noreply@example.com",
      maxAge: 24 * 60 * 60,
      options: {},
      sendVerificationRequest: sendMagicLink,
    },
  ],
  callbacks: {
    /**
     * Conturile se creează de către profesor, nu prin autoînregistrare
     * (brief §3). Un email necunoscut nu primește cont; unul dezactivat nu
     * primește sesiune.
     */
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const existing = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.email, email),
      });
      return existing !== undefined && existing.isActive;
    },
    /** Rolul ajunge în sesiune ca să nu fie nevoie de un query la fiecare pagină. */
    async session({ session, user }) {
      const record = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, user.id),
      });
      if (record) {
        session.user.id = record.id;
        session.user.role = record.role;
        session.user.locale = record.locale;
        session.user.isActive = record.isActive;
      }
      return session;
    },
  },
});
