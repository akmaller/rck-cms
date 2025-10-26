import { describe, expect, it } from "vitest";

import { sanitizeCommentContent, sanitizeMetadata } from "@/lib/comments/service";

describe("sanitizeCommentContent", () => {
  it("replaces HTML-sensitive characters with safe alternatives", () => {
    const input = "<script>alert('xss') & more</script>";
    const output = sanitizeCommentContent(input);
    expect(output).toBe("‹script›alert('xss') ＆ more‹/script›");
  });

  it("normalizes newlines and strips control characters", () => {
    const input = "Hello\r\nworld\u0000!\u200B";
    const output = sanitizeCommentContent(input);
    expect(output).toBe("Hello\nworld!");
  });
});

describe("sanitizeMetadata", () => {
  it("returns null for non-string input", () => {
    expect(sanitizeMetadata(undefined)).toBeNull();
    expect(sanitizeMetadata(null)).toBeNull();
  });

  it("trims, strips control characters, and limits length", () => {
    const input = "  Agent\u0000Name\u200B".padEnd(400, "x");
    const output = sanitizeMetadata(input, 12);
    expect(output).toBe("AgentNamexxx");
    expect(output?.length).toBeLessThanOrEqual(12);
  });
});
