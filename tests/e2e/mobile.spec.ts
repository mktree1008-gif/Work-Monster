import { expect, test } from "@playwright/test";

test("user can login and navigate mobile tabs", async ({ page }) => {
  await page.goto("/auth/login");

  await page.getByRole("link", { name: "Create account" }).click();
  await page.getByPlaceholder("monster_id or alex@work.com").fill("mobileuser");
  await page.getByPlaceholder("••••••••").nth(0).fill("mobilepass123");
  await page.getByPlaceholder("••••••••").nth(1).fill("mobilepass123");
  await page.getByRole("button", { name: "Create account and set nickname" }).click();
  await page.getByPlaceholder("e.g. Focus Rider").fill("Mobile Hero");
  await page.getByRole("button", { name: "Save nickname and continue" }).click();

  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible();
  await page.getByRole("link", { name: "Score" }).click();
  await expect(page.getByRole("heading", { name: "Score" })).toBeVisible();
  await page.getByRole("link", { name: "Rules" }).click();
  await expect(page.getByRole("heading", { name: "Rules" })).toBeVisible();
});

test("manager screen is mobile-accessible", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Manager" }).click();
  await page.getByPlaceholder("monster_id or alex@work.com").fill("mobilemanager");
  await page.getByPlaceholder("••••••••").nth(0).fill("managerpass123");
  await page.getByPlaceholder("••••••••").nth(1).fill("managerpass123");
  await page.getByRole("button", { name: "Create account and set nickname" }).click();
  await page.getByPlaceholder("e.g. Focus Rider").fill("Manager Hero");
  await page.getByRole("button", { name: "Save nickname and continue" }).click();

  await expect(page.getByRole("heading", { name: "Work Monster" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Submission review" })).toBeVisible();
});
