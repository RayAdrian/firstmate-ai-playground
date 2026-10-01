import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardCounts } from "@/components/community/card";
import { NamePrompt } from "@/components/community/name-prompt";
import { ReactionsBlock } from "@/components/community/reactions";
import { StarButton } from "@/components/community/star-button";
import type { CommunitySummary } from "@/lib/contracts";
import { __resetCommunityStoreForTests } from "@/lib/community/store";
import { __resetProgressStoreForTests, getState } from "@/lib/progress/store";

const SLUG = "plan-first";

function summary(over: Partial<CommunitySummary["reactions"]> = {}, stars = 12): CommunitySummary {
  const none = { count: 0, names: [] as string[] };
  return {
    slug: SLUG,
    stars,
    reactions: {
      worked: { count: 4, names: ["Rafael", "Ana"] },
      learned: { count: 1, names: [] },
      saved_time: none,
      game_changer: { count: 2, names: ["Lea"] },
      ...over,
    },
  };
}

type Call = { op: string; [key: string]: unknown };
let calls: Call[];
let handler: (body: Call) => Promise<Response> | Response;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  __resetProgressStoreForTests();
  __resetCommunityStoreForTests();
  calls = [];
  handler = (body) => (body.op === "mine" ? json({ ok: true, mine: [] }) : json({ ok: true }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Call;
      calls.push(body);
      return handler(body);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The failure text is both announced (#fm-live) and shown as a visible line; this finds the visible one. */
function visibleLine(text: string): HTMLElement | null {
  return screen.queryAllByText(text).find((el) => el.id !== "fm-live") ?? null;
}

async function renderBlock(over: Partial<CommunitySummary["reactions"]> = {}, closed = false) {
  const view = render(
    <>
      <StarButton slug={SLUG} title="Plan first" stars={12} variant="page" closed={closed} />
      <ReactionsBlock slug={SLUG} summary={summary(over)} closed={closed} />
    </>,
  );
  // `mine` resolves, then the toggles enable.
  await waitFor(() => expect(screen.getByRole("button", { name: /^Worked for me/ })).not.toHaveAttribute("aria-disabled"));
  return view;
}

describe("CM-2 reaction bar", () => {
  it("is a group of exactly four toggles named '<label> <count>', separate from the Star", async () => {
    await renderBlock();
    const group = screen.getByRole("group", { name: "Reactions" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Worked for me 4",
      "Learned something 1",
      "Saved me time 0",
      "Game-changer 2",
    ]);
    buttons.forEach((b) => expect(b).toHaveAttribute("aria-pressed", "false"));
    expect(within(group).queryByRole("button", { name: /Star/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Star, 12 stars" })).toHaveAttribute("aria-pressed", "false");
  });

  it("each toggle is described by its reactor line, which reads as one sentence", async () => {
    await renderBlock();
    const worked = screen.getByRole("button", { name: "Worked for me 4" });
    const line = document.getElementById(worked.getAttribute("aria-describedby") ?? "");
    expect(line).not.toBeNull();
    expect(line?.tagName).toBe("LI");
    expect(line).toHaveTextContent("Worked for me: Rafael and Ana and 2 others".replace("Rafael and Ana and", "Rafael, Ana and"));
    expect(screen.getByText("1 person")).toBeInTheDocument();
  });

  it("renders the short compact labels (prefixes of the full names) below md", async () => {
    await renderBlock();
    const worked = screen.getByRole("button", { name: "Worked for me 4" });
    const visible = Array.from(worked.querySelectorAll("span")).map((s) => s.textContent);
    expect(visible).toContain("Worked");
    expect(visible).toContain("Worked for me");
  });

  it("shows names as literal text and never as HTML (CM-4)", async () => {
    const evil = "<img src=x onerror=alert(1)>";
    const alert = vi.fn();
    vi.stubGlobal("alert", alert);
    await renderBlock({ worked: { count: 2, names: [evil, "Ana"] } });
    expect(screen.getByText(evil)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(alert).not.toHaveBeenCalled();
  });
});

describe("CM-5 optimistic toggles", () => {
  it("updates the pressed state and count at once, and sends the desired state", async () => {
    await renderBlock();
    const worked = screen.getByRole("button", { name: "Worked for me 4" });
    fireEvent.click(worked);
    expect(screen.getByRole("button", { name: "Worked for me 5" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(calls.filter((c) => c.op === "react")).toHaveLength(1));
    expect(calls.find((c) => c.op === "react")).toMatchObject({ slug: SLUG, reaction: "worked", on: true });
    fireEvent.click(screen.getByRole("button", { name: "Worked for me 5" }));
    expect(screen.getByRole("button", { name: "Worked for me 4" })).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(calls.filter((c) => c.op === "react")).toHaveLength(2));
    expect(calls.filter((c) => c.op === "react")[1]).toMatchObject({ on: false });
  });

  it("starting from my own saved state does not double-count", async () => {
    handler = (body) => (body.op === "mine" ? json({ ok: true, mine: [{ slug: SLUG, starred: true, reactions: ["worked"] }] }) : json({ ok: true }));
    await renderBlock();
    expect(screen.getByRole("button", { name: "Worked for me 4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Star, 12 stars" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Worked for me 4" }));
    expect(screen.getByRole("button", { name: "Worked for me 3" })).toHaveAttribute("aria-pressed", "false");
  });

  it("rolls back and says so when the write fails, and for rate limits", async () => {
    await renderBlock();
    handler = (body) => (body.op === "mine" ? json({ ok: true, mine: [] }) : json({ error: "unavailable" }, 503));
    fireEvent.click(screen.getByRole("button", { name: "Star, 12 stars" }));
    expect(screen.getByRole("button", { name: "Star, 13 stars" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: "Star, 12 stars" })).toHaveAttribute("aria-pressed", "false"));
    expect(visibleLine("Couldn't save your star. Try again.")).toBeInTheDocument();

    handler = () => json({ error: "rate_limited" }, 429);
    fireEvent.click(screen.getByRole("button", { name: "Learned something 1" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Learned something 1" })).toHaveAttribute("aria-pressed", "false"));
    expect(visibleLine("Too many changes. Wait a minute and try again.")).toBeInTheDocument();
  });

  it("treats a network failure like any failed write (rollback, no queue)", async () => {
    await renderBlock();
    handler = () => {
      throw new TypeError("Failed to fetch");
    };
    fireEvent.click(screen.getByRole("button", { name: "Game-changer 2" }));
    await waitFor(() => expect(visibleLine("Couldn't save your reaction. Try again.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Game-changer 2" })).toHaveAttribute("aria-pressed", "false");
  });

  it("five rapid clicks end in the state of the last click, sending one request", async () => {
    let release: (r: Response) => void = () => undefined;
    await renderBlock();
    handler = (body) => (body.op === "react" ? new Promise<Response>((r) => (release = r)) : json({ ok: true }));
    const name = /^Saved me time/;
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    await act(async () => release(json({ ok: true })));
    await waitFor(() => expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true"));
    expect(calls.filter((c) => c.op === "react")).toHaveLength(1);
  });

  it("four rapid clicks end off: a second request carries the final desired state", async () => {
    await renderBlock();
    let release: (r: Response) => void = () => undefined;
    handler = (body) => (body.op === "react" ? new Promise<Response>((r) => (release = r)) : json({ ok: true }));
    const name = /^Saved me time/;
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name }));
    handler = () => json({ ok: true });
    await act(async () => release(json({ ok: true })));
    await waitFor(() => expect(calls.filter((c) => c.op === "react")).toHaveLength(2));
    expect(calls.filter((c) => c.op === "react").map((c) => c.on)).toEqual([true, false]);
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
  });

  it("archived workflows keep their counts but every toggle is aria-disabled and ignores clicks (CM-11)", async () => {
    render(
      <>
        <StarButton slug={SLUG} title="Plan first" stars={12} variant="page" closed />
        <ReactionsBlock slug={SLUG} summary={summary()} closed />
      </>,
    );
    expect(screen.getByText("Reactions are closed on archived workflows.")).toBeInTheDocument();
    const worked = screen.getByRole("button", { name: "Worked for me 4" });
    expect(worked).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(worked);
    expect(screen.getByRole("button", { name: "Worked for me 4" })).toHaveAttribute("aria-pressed", "false");
    expect(calls.filter((c) => c.op === "react")).toHaveLength(0);
  });
});

describe("CM-4 the optional name", () => {
  it("prompts once after the first reaction without blocking it, then Skip is remembered", async () => {
    await renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Worked for me 4" }));
    const region = await screen.findByRole("region", { name: "Add your name? Optional" });
    expect(within(region).getByText("Thanks for sharing that.")).toBeInTheDocument();
    expect(within(region).getByRole("textbox", { name: "Your name" })).toHaveAttribute("maxlength", "40");
    await waitFor(() => expect(calls.some((c) => c.op === "react")).toBe(true));
    fireEvent.click(within(region).getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("region", { name: "Add your name? Optional" })).toBeNull();
    expect(getState().community).toMatchObject({ namePrompted: true, displayName: null });
    fireEvent.click(screen.getByRole("button", { name: "Learned something 1" }));
    expect(screen.queryByRole("region", { name: "Add your name? Optional" })).toBeNull();
    expect(screen.getByText("Reacting anonymously")).toBeInTheDocument();
  });

  it("Save normalises the name, stores it, writes it to the server and shows 'Reacting as'", async () => {
    await renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Star, 12 stars" }));
    const region = await screen.findByRole("region", { name: "Add your name? Optional" });
    expect(within(region).getByText("Thanks for the star.")).toBeInTheDocument();
    fireEvent.change(within(region).getByRole("textbox", { name: "Your name" }), { target: { value: "  Ra​fael  " } });
    fireEvent.click(within(region).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Add your name? Optional" })).toBeNull());
    expect(calls.find((c) => c.op === "name")).toMatchObject({ displayName: "Rafael" });
    expect(getState().community).toMatchObject({ displayName: "Rafael", namePrompted: true });
    expect(screen.getByText(/Reacting as/)).toHaveTextContent("Reacting as Rafael");
    expect(screen.getByRole("button", { name: "Edit name" })).toBeInTheDocument();
  });

  it("keeps the prompt open with an inline error when the name cannot be saved", async () => {
    await renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Worked for me 4" }));
    const region = await screen.findByRole("region", { name: "Add your name? Optional" });
    handler = () => json({ error: "unavailable" }, 503);
    fireEvent.change(within(region).getByRole("textbox", { name: "Your name" }), { target: { value: "Rafael" } });
    fireEvent.click(within(region).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Couldn't save your name. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Add your name? Optional" })).toBeInTheDocument();
    expect(getState().community.displayName).toBe("Rafael");
  });

  it("Escape in the prompt equals Skip", async () => {
    await renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Worked for me 4" }));
    const region = await screen.findByRole("region", { name: "Add your name? Optional" });
    fireEvent.keyDown(within(region).getByRole("textbox", { name: "Your name" }), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Add your name? Optional" })).toBeNull();
    expect(getState().community.namePrompted).toBe(true);
  });

  it("Edit name swaps in a prefilled form; clearing it makes reactions anonymous", async () => {
    await renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Worked for me 4" }));
    const region = await screen.findByRole("region", { name: "Add your name? Optional" });
    fireEvent.change(within(region).getByRole("textbox", { name: "Your name" }), { target: { value: "Rafael" } });
    fireEvent.click(within(region).getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "Edit name" });

    fireEvent.click(screen.getByRole("button", { name: "Edit name" }));
    const input = screen.getByRole("textbox", { name: "Your name" });
    expect(input).toHaveValue("Rafael");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Reacting anonymously");
    expect(calls.filter((c) => c.op === "name").at(-1)).toMatchObject({ displayName: null });
    expect(getState().community.displayName).toBeNull();
    expect(screen.getByRole("button", { name: "Add name" })).toBeInTheDocument();
  });

  it("sends the saved name with later reactions", async () => {
    await renderBlock();
    fireEvent.click(screen.getByRole("button", { name: "Worked for me 4" }));
    const region = await screen.findByRole("region", { name: "Add your name? Optional" });
    fireEvent.change(within(region).getByRole("textbox", { name: "Your name" }), { target: { value: "Ana" } });
    fireEvent.click(within(region).getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "Edit name" });
    fireEvent.click(screen.getByRole("button", { name: "Learned something 1" }));
    await waitFor(() => expect(calls.filter((c) => c.op === "react")).toHaveLength(2));
    expect(calls.filter((c) => c.op === "react")[1]).toMatchObject({ reaction: "learned", displayName: "Ana" });
  });
});

describe("NamePrompt placement", () => {
  it("renders nothing until a first star or reaction opens it for this workflow", () => {
    render(<NamePrompt slug={SLUG} />);
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("CM-2 card counts", () => {
  it("are read-only text: one visible compact row plus one sentence for screen readers", () => {
    const { container } = render(<CardCounts summary={summary()} />);
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent("🙌 4 · 💡 1 · 🔥 2");
    expect(screen.getByText("4 worked for me, 1 learned something, 2 game-changer")).toHaveClass("sr-only");
  });

  it("renders nothing when every count is zero", () => {
    const zero = { count: 0, names: [] };
    const { container } = render(
      <CardCounts summary={summary({ worked: zero, learned: zero, saved_time: zero, game_changer: zero })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CM-1 card star", () => {
  it("names the workflow and the count, and is aria-disabled until the pressed state loads", async () => {
    render(<StarButton slug={SLUG} title="Plan first" stars={4} variant="card" />);
    const star = screen.getByRole("button", { name: "Star Plan first, 4 stars" });
    expect(star).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(star).not.toHaveAttribute("aria-disabled"));
    fireEvent.click(star);
    expect(screen.getByRole("button", { name: "Star Plan first, 5 stars" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses singular and zero wording", () => {
    render(<StarButton slug="x" title="One" stars={1} variant="card" />);
    expect(screen.getByRole("button", { name: "Star One, 1 star" })).toBeInTheDocument();
  });
});
