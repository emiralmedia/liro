import { readFile } from "node:fs/promises";

/**
 * În dezvoltare nu se trimite niciun email: linkul de acces se scrie în consolă
 * și, dacă AUTH_DEV_LINK_FILE e setat, într-un fișier. Fără ajutorul de mai jos,
 * ecranul ar spune „verifică-ți emailul" pentru un email care nu există — și ai
 * căuta linkul prin loguri de fiecare dată.
 *
 * Nu poate apărea în producție: acolo `src/lib/auth.ts` refuză să pornească fără
 * cheie de email, deci fișierul nu se scrie niciodată.
 */
async function devMagicLink(): Promise<{ email: string; url: string } | null> {
  if (process.env.NODE_ENV === "production") return null;

  const sink = process.env.AUTH_DEV_LINK_FILE;
  if (!sink) return null;

  try {
    const lines = (await readFile(sink, "utf8")).trimEnd().split("\n");
    const last = lines.at(-1);
    if (!last) return null;
    const [email, url] = last.split("\t");
    if (!email || !url) return null;
    return { email, url };
  } catch {
    return null;
  }
}

export default async function VerifyRequestPage() {
  const link = await devMagicLink();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Проверьте почту</h1>
      <p className="mt-3 text-stone-700">
        Мы отправили ссылку для входа. Она действительна 24 часа.
      </p>
      <p className="mt-6 text-sm text-stone-600">
        Ți-am trimis linkul de acces pe email. Este valabil 24 de ore.
      </p>

      {link ? (
        <aside className="mt-10 rounded-md border border-dashed border-amber-400 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Mod dezvoltare</h2>
          <p className="mt-1 text-sm text-amber-900">
            Nu s-a trimis niciun email. Linkul generat pentru{" "}
            <span className="font-medium">{link.email}</span>:
          </p>
          <a
            href={link.url}
            className="mt-3 inline-flex min-h-11 items-center rounded-md bg-amber-900 px-4 text-sm font-medium text-white hover:bg-amber-800"
          >
            Intră direct
          </a>
        </aside>
      ) : null}
    </main>
  );
}
