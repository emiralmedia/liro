import { redirect } from "next/navigation";
import { getActor, homePathFor } from "@/lib/session";

/** Rădăcina nu afișează nimic: trimite fiecare rol în spațiul lui. */
export default async function Home() {
  const actor = await getActor();
  redirect(actor ? homePathFor(actor) : "/login");
}
