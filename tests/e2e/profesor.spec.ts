import { expect, test } from "@playwright/test";
import { clearMagicLinks, signIn } from "./helpers";

/**
 * Criteriul de gata pentru M0: profesorul se autentifică, își vede cursanții și
 * restanțele, iar spațiul cursantului îi este inaccesibil.
 */

test.beforeEach(async () => {
  await clearMagicLinks();
});

test("profesorul intră și vede dashboardul „Astăzi”", async ({ page }) => {
  await signIn(page, "profesor@liro.test");

  await expect(page).toHaveURL(/\/profesor/);
  await expect(page.getByRole("heading", { name: "Astăzi", level: 1 })).toBeVisible();

  // Toți cei trei cursanți alocați apar. Restrâns la lista de cursanți: un
  // cursant cu restanță apare și în secțiunea de mai sus, iar un selector
  // global ar fi ambiguu.
  const lista = page.getByRole("region", { name: "Cursanți" });
  await expect(lista.getByText("Анна Петрова")).toBeVisible();
  await expect(lista.getByText("Дмитрий Соколов")).toBeVisible();
  await expect(lista.getByText("Ольга Иванова")).toBeVisible();
});

test("restanța lui Dmitri e semnalată, a Annei nu", async ({ page }) => {
  await signIn(page, "profesor@liro.test");

  const restante = page.getByRole("region", { name: "Restanțe" });
  await expect(restante.getByText("Дмитрий Соколов")).toBeVisible();
  await expect(restante.getByText("Анна Петрова")).toHaveCount(0);
});

test("profesorul nu ajunge în spațiul cursantului", async ({ page }) => {
  await signIn(page, "profesor@liro.test");

  await page.goto("/cursant");
  await expect(page).toHaveURL(/\/profesor/);
});

test("un vizitator neautentificat e trimis la /login", async ({ page }) => {
  await page.goto("/profesor");
  await expect(page).toHaveURL(/\/login/);
});
