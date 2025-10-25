import AxeBuilder from "@axe-core/playwright";
import type { SerialFrameSelector } from "axe-core";
import type { Page, Locator } from "@playwright/test";

export type AxeRunContext = string | Locator | undefined;

export async function runAxe(page: Page, context?: AxeRunContext) {
  const builder = new AxeBuilder({ page });
  if (typeof context === "string") {
    builder.include(context);
  } else if (context) {
    builder.include(context as unknown as SerialFrameSelector);
  }

  const results = await builder.analyze();

  return {
    violations: results.violations ?? [],
    passes: results.passes ?? [],
  };
}

export function formatViolations(violations: Array<{ id: string; description: string; nodes: Array<{ html: string }> }>) {
  if (violations.length === 0) return "";
  return violations
    .map(
      (violation) =>
        `• [${violation.id}] ${violation.description}\n  ${violation.nodes
          .map((node) => node.html.replace(/\s+/g, " ").trim())
          .join("\n  ")}`,
    )
    .join("\n");
}
