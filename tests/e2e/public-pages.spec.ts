import { expect, test } from "@playwright/test";

test.describe("Halaman publik", () => {
  test("home menampilkan hero dan tombol jelajah", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Roemah Cita");
    await expect(page.getByRole("link", { name: /Jelajahi Artikel/i })).toBeVisible();
  });

  test("halaman login menampilkan formulir autentikasi", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Kelola konten Anda/i })).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Masuk/i })).toBeVisible();
  });
});

