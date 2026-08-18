import { readFile, rm } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

const MAGIC_LINK_FILE = ".tools/magic-links.txt";

/** Ultimul link magic emis pentru o adresă. Vezi src/lib/auth.ts. */
async function lastMagicLinkFor(email: string): Promise<string> {
  // Serverul scrie fișierul asincron, imediat după cererea de autentificare.
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const content = await readFile(MAGIC_LINK_FILE, "utf8");
      const match = content
        .trimEnd()
        .split("\n")
        .reverse()
        .find((line) => line.startsWith(`${email}\t`));
      if (match) return match.split("\t")[1]!;
    } catch {
      // fișierul încă nu există
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Niciun link magic pentru ${email} în ${MAGIC_LINK_FILE}`);
}

export async function clearMagicLinks(): Promise<void> {
  await rm(MAGIC_LINK_FILE, { force: true });
}

/**
 * Așteaptă ca React să fi atașat handlerele pe un buton.
 *
 * Playwright consideră un buton „gata" când e vizibil și activ — dar asta se
 * întâmplă la randarea de pe server, înainte ca React să hidrateze pagina. Un
 * click în fereastra aceea nu declanșează nimic și dispare fără urmă: fără
 * eroare, fără cerere de rețea, fără schimbare în interfață.
 *
 * Verificăm direct prezența props-urilor React pe elementul respectiv, în loc
 * să dormim un număr de milisecunde ales la noroc.
 */
export async function waitForHydration(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).waitFor({ state: "visible" });

  await page.waitForFunction(
    (label) => {
      const el = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === label,
      );
      if (!el) return false;
      const key = Object.keys(el).find((k) => k.startsWith("__reactProps"));
      if (!key) return false;
      const props = (el as unknown as Record<string, { onClick?: unknown }>)[key];
      return typeof props?.onClick === "function";
    },
    name,
    { timeout: 15_000 },
  );
}

/** Așteaptă hidratarea, apoi apasă butonul. */
export async function clickWhenHydrated(page: Page, name: string): Promise<void> {
  await waitForHydration(page, name);
  await page.getByRole("button", { name, exact: true }).click();
}

/**
 * Autentificare completă prin magic link, exact pe fluxul real: formularul de
 * pe /login, apoi linkul primit. Fără scurtături care ar ocoli Auth.js.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/Email/i).fill(email);
  await page.getByRole("button", { name: /Получить ссылку/i }).click();

  const link = await lastMagicLinkFor(email);
  await page.goto(link);

  // Auth.js prezintă o pagină de confirmare înainte de a consuma tokenul.
  const confirm = page.getByRole("button", { name: /sign in|войти|continue/i });
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
  }
  await expect(page).not.toHaveURL(/\/login/);
}
