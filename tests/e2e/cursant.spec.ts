import { expect, test } from "@playwright/test";
import { clearMagicLinks, signIn } from "./helpers";

/**
 * Cursantul, pe telefon (proiectul `cursant-mobil` din playwright.config.ts).
 * Interfața trebuie să fie integral în rusă, iar conținutul nealocat invizibil.
 */

test.beforeEach(async () => {
  await clearMagicLinks();
});

test("cursantul intră și vede ce are de făcut acum", async ({ page }) => {
  await signIn(page, "anna@liro.test");

  await expect(page).toHaveURL(/\/cursant/);
  await expect(page.getByRole("heading", { name: "Что делать сейчас", level: 1 })).toBeVisible();
  await expect(page.getByText("Привет! Меня зовут...")).toBeVisible();
});

test("interfața cursantului este marcată ca fiind în rusă", async ({ page }) => {
  await signIn(page, "anna@liro.test");
  // Cititoarele de ecran trebuie să pronunțe rusește, nu românește.
  await expect(page.locator("div[lang='ru']").first()).toBeVisible();
});

test("cursantul cu temă restantă o vede semnalată prioritar", async ({ page }) => {
  await signIn(page, "dmitri@liro.test");

  const overdue = page.getByRole("region", { name: "Просроченное задание" });
  await expect(overdue).toBeVisible();
});

test("un cursant fără lecții alocate nu vede conținut", async ({ page }) => {
  // Olga nu are nicio alocare, deși în bibliotecă există o lecție publicată.
  await signIn(page, "olga@liro.test");

  await expect(page.getByText("Пока нет открытых уроков.")).toBeVisible();
  await expect(page.getByText("Привет! Меня зовут...")).toHaveCount(0);
});

test("cursantul nu ajunge în spațiul profesorului", async ({ page }) => {
  await signIn(page, "anna@liro.test");

  await page.goto("/profesor");
  await expect(page).toHaveURL(/\/cursant/);
  await expect(page.getByRole("heading", { name: "Astăzi" })).toHaveCount(0);
});
