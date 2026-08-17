import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { getActor, homePathFor } from "@/lib/session";

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Liro</h1>
      <p className="mt-2 text-stone-600">
        Учим румынский · Învățăm româna
      </p>

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
          className="min-h-12 rounded-md border border-stone-300 px-4 text-base"
        />
        <button
          type="submit"
          className="min-h-12 rounded-md bg-stone-900 px-4 text-base font-medium text-white hover:bg-stone-800"
        >
          Получить ссылку для входа
        </button>
      </form>

      <p className="mt-6 text-sm text-stone-600">
        Мы отправим ссылку на почту — пароль не нужен.
      </p>
    </main>
  );
}
