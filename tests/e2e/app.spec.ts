import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("administrator opens the roster and can sign out", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Расход личного состава")).toBeVisible();
  await expect(page.getByRole("button", { name: /Выйти/ }).first()).toBeVisible();
});

test("browser Back returns from an internal service section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Группы", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: /Распределение/ })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Расход личного состава")).toBeVisible();
});

test.describe("anonymous login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows login and has no serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  });
});

test.describe("roster read-only role", () => {
  test.use({ storageState: "playwright/.auth/roster-reader.json" });

  test("sees only permitted navigation and no enabled mutations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Расход личного состава")).toBeVisible();
    await expect(page.getByRole("button", { name: "Группы", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Задачи", exact: true })).toHaveCount(0);
    const mutations = page.getByRole("button", { name: /^Перевести / });
    for (let index = 0; index < await mutations.count(); index += 1) {
      await expect(mutations.nth(index)).toBeDisabled();
    }
  });
});

test.describe("groups read-only role", () => {
  test.use({ storageState: "playwright/.auth/groups-reader.json" });

  test("lands on groups without write controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Распределение/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать группу" })).toHaveCount(0);
  });
});

test.describe("groups writer resilience", () => {
  test.use({ storageState: "playwright/.auth/groups-writer.json" });

  test("keeps recovery available after a failed rotation", async ({ page }) => {
    await page.goto("/");
    await page.route("**/api/groups/rotate", (route) => route.abort("failed"));
    await page.getByRole("button", { name: /ротацию/i }).click();
    const alert = page
      .getByRole("alert")
      .filter({ hasText: "Действие не завершено" });
    await expect(alert).toContainText("Проверьте соединение и повторите попытку.");
    await expect(alert.getByRole("button", { name: "Обновить данные" })).toBeVisible();
  });

  test("requires an in-app confirmation before deleting a group", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Опасная зона" }).click();
    await page.getByRole("button", { name: "Удалить группу" }).click();

    const confirmation = page
      .getByRole("alert")
      .filter({ hasText: "Удалить группу?" });
    await expect(confirmation).toContainText("без возможности отмены");
    await expect(confirmation.getByRole("button", { name: "Отмена" })).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Удалить" })).toBeVisible();
  });
});

test.describe("tasks read-only role", () => {
  test.use({ storageState: "playwright/.auth/tasks-reader.json" });

  test("lands on tasks without create controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Задачи" })).toBeVisible();
    await expect(page.getByLabel("Название новой задачи")).toHaveCount(0);
  });
});
