import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { getActor, homePathFor } from "@/lib/session";
import { Brand } from "@/components/ui";

/**
 * Pagina de acces. Bilingvă deliberat: aici încă nu știm cine intră, iar
 * cursantul rusofon trebuie să înțeleagă ecranul fără să ghicească.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const actor = await getActor();
  if (actor) redirect(homePathFor(actor));

  const { error } = await searchParams;

  async function requestLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    await signIn("email", { email, redirectTo: "/" });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
      <section className="surface-dark dot-grid hidden flex-col justify-between p-12 text-white lg:flex">
        <Brand />
        <div className="max-w-xl">
          <p className="font-reading text-2xl italic text-white/65">„O limbă nouă înseamnă o lume mai aproape.”</p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05]">Româna, explicată<br />pe limba ta.</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">Lecții unu-la-unu pentru vorbitori de rusă, cu un parcurs clar și feedback de la profesor.</p>
        </div>
        <p className="text-sm text-white/40">Română · Русский</p>
      </section>
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
      <div className="mx-auto w-full max-w-md">
      <div className="mb-12 lg:hidden"><Brand /></div>
      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-accent">Bine ai revenit · С возвращением</p>
      <h2 className="mt-2 text-4xl font-semibold">Intră în Liro</h2>
      <p className="mt-3 text-ink-soft">Primești pe email o legătură sigură. Nu ai nevoie de parolă.</p>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800"
        >
          Не удалось войти. Проверьте адрес или обратитесь к преподавателю.
          <span className="mt-1 block text-red-700">
            Autentificare eșuată. Verifică adresa sau contactează profesorul.
          </span>
        </p>
      ) : null}

      <form action={requestLink} className="mt-8 flex flex-col gap-3">
        <label htmlFor="email" className="font-medium">
          Электронная почта / Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="min-h-13 rounded-xl border border-line-strong bg-surface px-4 text-base shadow-card"
        />
        <button
          type="submit"
          className="min-h-13 rounded-xl bg-accent px-4 text-base font-semibold text-white shadow-card hover:bg-accent-hover"
        >
          Получить ссылку для входа
        </button>
      </form>

      <p className="mt-5 text-sm text-ink-faint">Мы отправим ссылку на почту — пароль не нужен.</p>
      </div>
      </section>
    </main>
  );
}
