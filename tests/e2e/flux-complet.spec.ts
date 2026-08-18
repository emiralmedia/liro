import { and, eq } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import { db } from "@/db";
import { assignments, attempts, homework } from "@/db/schema";
import { SEED } from "@/db/seed-ids";
import { clearMagicLinks, clickWhenHydrated, signIn, waitForHydration } from "./helpers";

/**
 * Testul cap-coadă: o lecție parcursă integral, de la cursant până la
 * corectarea profesorului.
 *
 * Acoperă exact fluxul din brief §6 — cursantul parcurge teoria, audio-ul și
 * exercițiile, primește feedback imediat, iar profesorul revizuiește DOAR
 * excepțiile pe care corectarea automată nu le-a putut decide.
 */

/**
 * Testele din acest fișier sunt un singur scenariu, în pași — de aceea `serial`:
 * dacă un pas cade, restul nu mai are ce verifica.
 *
 * Contează și practic: la un eșec, Playwright aruncă workerul și pornește altul,
 * care ar re-rula `beforeAll` și ar șterge exact datele pe care pașii următori
 * urmau să le inspecteze. Așa, diagnosticul rămâne citibil.
 */
test.describe.configure({ mode: "serial" });

/** Pornim de la o stare cunoscută la fiecare rulare. */
test.beforeAll(async () => {
  await db.delete(attempts).where(eq(attempts.assignmentId, SEED.assignments.annaLesson1));
  await db
    .update(homework)
    .set({ state: "in_progress", submittedAt: null })
    .where(eq(homework.assignmentId, SEED.assignments.annaLesson1));
  await db
    .update(assignments)
    .set({ state: "unlocked" })
    .where(eq(assignments.id, SEED.assignments.annaLesson1));
});

test.beforeEach(async () => {
  await clearMagicLinks();
});

test("cursantul parcurge lecția, iar profesorul corectează răspunsul liber", async ({ page }) => {
  // ---------- 1. Cursantul deschide lecția ----------
  await signIn(page, "anna@liro.test");
  await expect(page.getByRole("heading", { name: "Что делать сейчас" })).toBeVisible();

  await page.getByRole("link", { name: /Начать урок|Продолжить/ }).click();
  await expect(page).toHaveURL(/\/cursant\/urok\//);

  // ---------- 2. Conținutul lecției e prezent ----------
  await expect(page.getByRole("heading", { name: "Привет! Меня зовут...", level: 1 })).toBeVisible();
  // Teoria explică interferența rusofonă: verbul reflexiv „a se numi".
  await expect(page.getByText("«a se numi» — возвратный")).toBeVisible();
  // Vocabularul activ. Restrâns la secțiunea lui: aceeași expresie apare și în
  // exercițiul de asociere, iar un selector global ar fi ambiguu.
  await expect(
    page.getByRole("region", { name: "Словарь" }).getByText("îmi pare bine"),
  ).toBeVisible();

  // ---------- 3. Audio: transcrierea e ascunsă până o ceri ----------
  await expect(page.getByText("Mă numesc Elena")).toHaveCount(0);

  await clickWhenHydrated(page, "Показать текст");
  await expect(page.getByText("Mă numesc Elena")).toBeVisible();

  // ---------- 4. Exercițiile ----------
  // Fiecare exercițiu se adresează prin tipul lui, nu prin poziție: după ce
  // unul e rezolvat, câmpurile lui rămân în pagină dar dezactivate, iar un
  // selector „primul de acest fel" ar nimeri controlul greșit.
  const ex = (type: string) => page.getByTestId(`exercise-${type}`);
  const answer = (type: string) => ex(type).getByRole("button", { name: "Ответить" });

  // 1. Alegere multiplă — „Bună ziua!" este forma politicoasă.
  await ex("mcq").getByRole("radio").nth(1).check();
  await answer("mcq").click();
  await expect(ex("mcq").getByText("Верно")).toBeVisible();

  // 2. Completare, scrisă FĂRĂ diacritice: corectă ca formă, punctaj parțial.
  await ex("fill").getByRole("textbox").fill("ma");
  await answer("fill").click();
  await expect(ex("fill").getByText("Почти — не хватает диакритики")).toBeVisible();

  // 3. Asociere — două perechi corecte din trei.
  await ex("match").getByLabel("Перевод для «bună ziua»").selectOption("здравствуйте");
  await ex("match").getByLabel("Перевод для «la revedere»").selectOption("до свидания");
  await ex("match").getByLabel("Перевод для «îmi pare bine»").selectOption("здравствуйте");
  await answer("match").click();
  await expect(ex("match").getByText("Частично верно")).toBeVisible();

  // 4. Ordonare — particula reflexivă stă înaintea verbului: „Mă numesc Dmitri".
  for (const word of ["Mă", "numesc", "Dmitri"]) {
    await ex("order").getByRole("button", { name: word, exact: true }).click();
  }
  await answer("order").click();
  await expect(ex("order").getByText("Верно")).toBeVisible();

  // 5. Răspuns liber pe care motorul NU îl poate decide → merge la profesor.
  await ex("short").getByRole("textbox").fill("Меня зовут Анна");
  await answer("short").click();
  await expect(ex("short").getByText("Отправлено преподавателю")).toBeVisible();

  // 6. Întrebare după audio — femeia din dialog se numește Elena.
  await ex("audio_q").getByRole("radio").first().check();
  await answer("audio_q").click();
  await expect(ex("audio_q").getByText("Верно")).toBeVisible();

  // Contorul de progres e sursa de adevăr pentru „toate rezolvate".
  await expect(page.getByText("6 из 6")).toBeVisible();

  // ---------- 5. Trimite tema ----------
  await page.getByRole("button", { name: "Отправить задание" }).click();
  await expect(page.getByText("Задание отправлено преподавателю.")).toBeVisible();
});

test("profesorul vede doar excepția în coada de revizuire și o corectează", async ({ page }) => {
  await signIn(page, "profesor@liro.test");

  // Dashboardul semnalează că e ceva de revizuit.
  await page.getByRole("link", { name: /De revizuit/ }).first().click();
  await expect(page).toHaveURL(/\/profesor\/revizuire/);

  // Doar răspunsul liber a ajuns aici — celelalte cinci au fost decise automat.
  const cards = page.getByRole("listitem");
  await expect(cards).toHaveCount(1);
  await expect(page.getByText("Меня зовут Анна")).toBeVisible();
  await expect(page.getByText("Анна Петрова")).toBeVisible();

  // Profesorul acordă punctajul întreg: formularea e corectă, deși nu canonică.
  // Textul se scrie DUPĂ hidratare — altfel valoarea ajunge în DOM, dar React
  // nu o vede și feedbackul se pierde la salvare.
  await waitForHydration(page, "2");
  await page.getByRole("textbox").fill("Formulare corectă, acceptată.");

  await clickWhenHydrated(page, "2");
  await expect(page.getByText(/Corectat: Анна Петрова/)).toBeVisible({ timeout: 15_000 });
});

test("după corectare, coada rămâne goală", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await page.goto("/profesor/revizuire");

  await expect(page.getByText("Corectarea automată a rezolvat tot.")).toBeVisible();
});

test("scorul profesorului îl înlocuiește pe cel automat în baza de date", async () => {
  // Invariantul 3, verificat la sursă: scorul automat rămâne pentru audit.
  const [reviewed] = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.assignmentId, SEED.assignments.annaLesson1),
        eq(attempts.exerciseId, SEED.exercises.short),
      ),
    );

  expect(reviewed?.autoScore).toBe(0);
  expect(reviewed?.teacherScore).toBe(2);
  expect(reviewed?.needsReview).toBe(false);
  expect(reviewed?.teacherFeedback).toBe("Formulare corectă, acceptată.");
});
