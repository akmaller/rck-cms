export function extractPlainTextFromContent(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    return node.map(extractPlainTextFromContent).join(" ");
  }
  if (typeof node === "object") {
    const anyNode = node as { text?: unknown; content?: unknown };
    let text = "";
    if (typeof anyNode.text === "string") {
      text += anyNode.text;
    }
    if (Array.isArray(anyNode.content)) {
      text += ` ${anyNode.content.map(extractPlainTextFromContent).join(" ")}`;
    }
    return text;
  }
  return "";
}
