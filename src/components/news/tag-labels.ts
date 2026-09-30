import type { NewsTag } from "@/lib/contracts";

/** Display order is fixed so the security chip is always last (DESIGN 4.12). */
export const TAG_ORDER: readonly NewsTag[] = ["new-model", "tooling", "framework", "business", "security"];

export const TAG_LABEL: Record<NewsTag, string> = {
  "new-model": "New model",
  tooling: "Tooling",
  framework: "Framework",
  business: "Business",
  security: "Security",
};
