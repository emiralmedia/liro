import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { clearMagicLinks, signIn } from "./helpers";

/**
 * Prag de merge: zero violări serioase sau critice (brief §7).
 * Cele moderate se raportează, dar nu blochează.
 */
const BLOCKING = ["serious", "critical"];

async function scan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter((v) => BLOCKING.includes(v.impact ?? ""));
  return { blocking, all: results.violations };
}

test.beforeEach(async () => {
  await clearMagicLinks();
});

test("pagina de acces nu are violări serioase", async ({ page }) => {
  await page.goto("/login");
  const { blocking } = await scan(page);
  expect(
    blocking,
    `Violări: ${blocking.map((v) => `${v.id} (${v.impact})`).join(", ")}`,
  ).toEqual([]);
});

test("dashboardul profesorului nu are violări serioase", async ({ page }) => {
  await signIn(page, "profesor@liro.test");
  await expect(page).toHaveURL(/\/profesor/);

  const { blocking } = await scan(page);
  expect(
    blocking,
    `Violări: ${blocking.map((v) => `${v.id} (${v.impact})`).join(", ")}`,
  ).toEqual([]);
});

test("acțiunea principală e accesibilă din tastatură", async ({ page }) => {
  // Profesorul predă cu mâinile pe tastatură; nimic esențial nu poate depinde
  // exclusiv de mouse.
  await page.goto("/login");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");

  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  await expect(focused).toHaveRole("button");
});
