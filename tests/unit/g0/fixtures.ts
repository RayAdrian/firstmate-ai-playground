import { diagramSchema, type Diagram, type DiagramInput } from "@/lib/contracts/diagram";

export const L24 = "abcdefghijklmnopqrstuvwx"; // 24 chars
export const label2 = `${L24}\n${L24}`; // 49 chars, 2 lines
export const SUB28 = "abcdefghijklmnopqrstuvwxyz12"; // 28 chars
export const EDGE16 = "abcdefghijklmnop"; // 16 chars

export const flowInput = (): DiagramInput => ({
  type: "flow",
  id: "ask-loop",
  title: "Ask, edit, approve, verify",
  summary: "Every change goes through a human approval and a check.",
  steps: [
    { id: "ask", label: "Ask", next: "plan" },
    { id: "edit", label: "Edit", sub: "agent proposes", emphasis: true },
    { id: "approve", label: "Approve" },
    { id: "verify", label: "Verify" },
  ],
  loops: [{ from: "verify", to: "edit", label: "fails" }],
  exits: [{ from: "verify", label: "passes", text: "Merge", style: "ok" }],
});

export const stackInput = (): DiagramInput => ({
  type: "stack",
  id: "guarantees",
  title: "The guarantee ladder",
  summary: "Hooks are the only layer the agent cannot talk its way past.",
  layers: [
    { id: "instructions", label: "Instructions" },
    { id: "skills", label: "Skills", sub: "loaded on demand" },
    { id: "hooks", label: "Hooks", emphasis: true },
  ],
  axis: { low: "suggested", high: "enforced" },
});

export const boundaryInput = (): DiagramInput => ({
  type: "boundary",
  id: "trust-zones",
  title: "Trust zones",
  summary: "Untrusted text can reach the model but must not reach the shell.",
  zones: [
    {
      id: "outside",
      label: "Outside",
      items: [{ id: "web", label: "Web page" }],
      zones: [{ id: "sandbox", label: "Sandbox", items: [{ id: "model", label: "Model", emphasis: true }] }],
    },
    { id: "host", label: "Host", items: [{ id: "shell", label: "Shell" }] },
  ],
  crossings: [
    { from: "web", to: "model", label: "injects", style: "risk" },
    { from: "sandbox", to: "host", label: "asks first" },
  ],
});

export const lanesInput = (): DiagramInput => ({
  type: "lanes",
  id: "gate-race",
  title: "Review A, push B",
  summary: "A status on A does not carry over to B.",
  lanes: [
    { id: "reviewer", label: "Reviewer" },
    { id: "author", label: "Author" },
  ],
  steps: [
    { id: "review-a", label: "Review A", lane: "reviewer", col: 1 },
    { id: "push-b", label: "Push B", lane: "author", col: 2 },
    { id: "post-a", label: "Post success", lane: "reviewer", col: 3, emphasis: true },
  ],
  handoffs: [
    { from: "review-a", to: "push-b" },
    { from: "push-b", to: "post-a", label: "refused", style: "risk" },
  ],
  marker: { col: 3, label: "Head moved", style: "risk" },
});

export const parse = (d: DiagramInput): Diagram => diagramSchema.parse(d);

/** Every label at 2 lines of 24 characters and every count at its cap. */
export const capFlow = (): DiagramInput => {
  const ids = ["s1", "s2", "s3", "s4", "s5", "s6"];
  return {
    type: "flow",
    id: "cap-flow",
    title: "t".repeat(60),
    summary: "s".repeat(200),
    steps: ids.map((id, i) => ({ id, label: label2, sub: SUB28, next: EDGE16, ...(i === 0 ? { emphasis: true as const } : {}) })),
    loops: [
      { from: "s3", to: "s1", label: EDGE16 },
      { from: "s6", to: "s6", label: EDGE16 },
    ],
    exits: [
      { from: "s2", label: EDGE16, text: label2, style: "ok" },
      { from: "s6", label: EDGE16, text: label2, style: "risk" },
    ],
  };
};

export const capStack = (): DiagramInput => ({
  type: "stack",
  id: "cap-stack",
  title: "t".repeat(60),
  summary: "s".repeat(200),
  layers: ["l1", "l2", "l3", "l4", "l5"].map((id) => ({ id, label: label2, sub: SUB28 })),
  axis: { low: EDGE16, high: EDGE16 },
});

export const capBoundary = (): DiagramInput => {
  const items = (p: string) => ["a", "b", "c", "d"].map((x) => ({ id: `${p}-${x}`, label: label2, sub: SUB28 }));
  return {
    type: "boundary",
    id: "cap-boundary",
    title: "t".repeat(60),
    summary: "s".repeat(200),
    zones: [
      { id: "z1", label: L24, items: items("z1"), zones: [{ id: "z2", label: L24, items: items("z2") }] },
      { id: "z3", label: L24, items: items("z3") },
    ],
    crossings: ["a", "b", "c", "d"].map((x) => ({ from: `z1-${x}`, to: `z3-${x}`, label: EDGE16, style: "risk" as const })),
  };
};

export const capLanes = (): DiagramInput => ({
  type: "lanes",
  id: "cap-lanes",
  title: "t".repeat(60),
  summary: "s".repeat(200),
  lanes: ["l1", "l2", "l3"].map((id) => ({ id, label: L24 })),
  steps: [1, 2, 3, 4, 5, 6].map((col) => ({ id: `st${col}`, label: label2, sub: SUB28, lane: ["l1", "l2", "l3"][col % 3], col })),
  handoffs: [
    { from: "st1", to: "st2", label: EDGE16 },
    { from: "st2", to: "st3", label: EDGE16 },
    { from: "st3", to: "st4", label: EDGE16 },
    { from: "st4", to: "st5", label: EDGE16, style: "risk" },
  ],
  marker: { col: 6, label: L24, style: "ok" },
});
