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
