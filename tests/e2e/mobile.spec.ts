import { expect, test } from "@playwright/test";

test("user can login and navigate mobile tabs", async ({ page }) => {
  await page.goto("/auth/login");

  await page.getByPlaceholder("monster_id").fill("mobileuser");
  await page.getByPlaceholder("Monster Hero").fill("Mobile Hero");
  await page.getByPlaceholder("••••••••").fill("mobilepass123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible();
  await page.getByRole("link", { name: "Score" }).click();
  await expect(page.getByRole("heading", { name: "Score" })).toBeVisible();
  await page.getByRole("link", { name: "Rules" }).click();
  await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
});

test("manager screen is mobile-accessible", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("button", { name: "Manager" }).click();
  await page.getByPlaceholder("monster_id").fill("mobilemanager");
  await page.getByPlaceholder("Monster Hero").fill("Manager Hero");
  await page.getByPlaceholder("••••••••").fill("managerpass123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Work Monster" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Submission review" })).toBeVisible();
});
