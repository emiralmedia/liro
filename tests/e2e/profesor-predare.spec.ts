import { expect, test } from "@playwright/test";
import { SEED } from "@/db/seed-ids";
import { clearMagicLinks, signIn } from "./helpers";

/**
 * Modul de predare live (brief §5 și §6): ecran curat, fără controale
 * administrative, parcurs din tastatură.
 */

test.beforeEach(async () => {
  await clearMagicLinks();
});

test("profesorul pornește predarea din profilul cursantului", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.goto(`/profesor/cursant/${SEED.students.anna}`);

  await page.getByRole("link", { name: "Predă" }).first().click();
  await expect(page).toHaveURL(/\/preda\//);
  await expect(page.getByRole("heading", { name: "Привет! Меня зовут...", level: 1 })).toBeVisible();
});

test("ecranul de predare nu arată controalele administrative", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.goto(`/preda/${SEED.assignments.annaLesson1}`);

  // Meniul aplicației și acțiunile de administrare nu au ce căuta pe ecranul
  // proiectat în timpul lecției.
  await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Bibliotecă" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Deblochează" })).toHaveCount(0);
});

test("lecția se parcurge integral din tastatură", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.goto(`/preda/${SEED.assignments.annaLesson1}`);

  await expect(page.getByText("1 /")).toBeVisible();

  // Săgeata dreapta avansează; teoria vine imediat după titlu.
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("În română salutăm diferit")).toBeVisible();

  // Săgeata stânga se întoarce.
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("heading", { name: "Привет! Меня зовут...", level: 1 })).toBeVisible();
});

test("răspunsul unui exercițiu se dezvăluie la cerere, nu implicit", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.goto(`/preda/${SEED.assignments.annaLesson1}`);

  // Mergem până la primul exercițiu.
  for (let i = 0; i < 20; i++) {
    if (await page.getByText("Exercițiul 1 din").isVisible().catch(() => false)) break;
    await page.keyboard.press("ArrowRight");
  }
  await expect(page.getByText("Exercițiul 1 din")).toBeVisible();

  // Răspunsul e ascuns până îl cere profesorul — altfel cursantul îl vede
  // înainte să apuce să răspundă.
  await expect(page.getByText("Ascunde răspunsul")).toHaveCount(0);
  await page.keyboard.press(" ");
  await expect(page.getByText("Ascunde răspunsul")).toBeVisible();
});

test("Esc întoarce profesorul la profilul cursantului", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.goto(`/preda/${SEED.assignments.annaLesson1}`);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/profesor/cursant/${SEED.students.anna}`));
});

test("un cursant nu poate deschide ecranul de predare", async ({ page }) => {
  await signIn(page, "anna@liro.test");
  const response = await page.goto(`/preda/${SEED.assignments.annaLesson1}`);

  // `assertRole` respinge cererea: pagina nu se randează.
  expect(response?.status()).toBeGreaterThanOrEqual(400);
});
