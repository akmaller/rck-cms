import { expect, test } from "@playwright/test";

import { formatViolations, runAxe } from "./utils/axe";

const pagesToCheck: Array<{ path: string; name: string }> = [
  { path: "/", name: "Beranda" },
  { path: "/articles", name: "Daftar Artikel Publik" },
  { path: "/login", name: "Halaman Login" },
];

test.describe("Aksesibilitas Halaman Publik", () => {
  for (const { path, name } of pagesToCheck) {
    test(`halaman ${name} bebas dari pelanggaran kritis`, async ({ page }) => {
      await page.goto(path);
      const { violations } = await runAxe(page);
      expect(violations.length, `Pelanggaran aksesibilitas terdeteksi:\n${formatViolations(violations)}`).toBe(0);
      await expect(page).toHaveTitle(/Roemah Cita|Masuk/);
    });
  }
});
