import { eq } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { db } from "@/db";
import { assignments } from "@/db/schema";
import { SEED } from "@/db/seed-ids";
import { clearMagicLinks, signIn, waitForHydration } from "./helpers";

/**
 * Acțiunile profesorului: fără ele, dashboardul e doar un raport.
 * Brief §5: „profesorul alege pentru fiecare cursant ce lecții se activează".
 */

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Olga pornește fără nicio alocare — starea din seed.
  await db.delete(assignments).where(eq(assignments.studentId, SEED.students.olga));
});

/**
 * Testul deblochează o lecție pentru Olga — starea ei implicită („fără nicio
 * alocare") e verificată de alte suite, așa că o restaurăm la ieșire.
 */
test.afterAll(async () => {
  await db.delete(assignments).where(eq(assignments.studentId, SEED.students.olga));
});

test.beforeEach(async () => {
  await clearMagicLinks();
});

test("profesorul deschide profilul unui cursant din dashboard", async ({ page }) => {
  await signIn(page, "profesor@liro.test");

  await page.getByRole("link", { name: "Ольга Иванова" }).click();
  await expect(page).toHaveURL(/\/profesor\/cursant\//);
  await expect(page.getByRole("heading", { name: "Ольга Иванова", level: 1 })).toBeVisible();
  await expect(page.getByText("Niciun conținut deblocat încă.")).toBeVisible();
});

test("profesorul deblochează o lecție, iar cursanta o primește", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.goto(`/profesor/cursant/${SEED.students.olga}`);

  await waitForHydration(page, "Deblochează");
  // Alegem lecția explicit, după id: nu depinde de ordinea din listă.
  await page.getByLabel("Lecție", { exact: true }).selectOption(SEED.lessonVersion);
  await page.getByLabel("Termen", { exact: true }).selectOption("7");
  await page.getByRole("button", { name: "Deblochează" }).click();

  // Lecția apare în parcursul cursantei.
  await expect(page.getByRole("region", { name: "Lecții alocate" })).toContainText(
    "Salut! Mă numesc...",
  );

  // ...și devine vizibilă pentru ea, care până acum nu avea nimic.
  await page.context().clearCookies();
  await clearMagicLinks();
  await signIn(page, "olga@liro.test");
  await expect(page.getByText("Привет! Меня зовут...")).toBeVisible();
  await expect(page.getByRole("link", { name: "Начать урок" })).toBeVisible();
});

test("biblioteca arată ambele lecții publicate", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.getByRole("link", { name: "Bibliotecă" }).click();

  await expect(page.getByText("Salut! Mă numesc...")).toBeVisible();
  await expect(page.getByText("De unde sunteți?")).toBeVisible();
});
