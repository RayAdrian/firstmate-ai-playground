import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "@/components/ui/code-block";
import { LessonDiagram } from "@/components/diagram/lesson-diagram";
import { INLINE_CODE_CLASS } from "./inline-text";

// Lesson markdown is rendered safely (L-7):
//  - raw HTML in the source is shown as literal text, never parsed (remarkHtmlAsText);
//  - the resulting tree is sanitized (rehype-sanitize, default GitHub-style schema);
//  - unsafe link/image protocols are dropped;
//  - external links open in a new tab with rel="noopener noreferrer".

type MdNode = { type: string; value?: string; children?: MdNode[] };
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  data?: { meta?: string | null };
  children?: HastNode[];
};

/** Turn mdast `html` nodes (block and inline) into plain text so they display verbatim. */
function remarkHtmlAsText() {
  return (tree: MdNode) => {
    const walk = (node: MdNode, parent: MdNode | null, index: number) => {
      if (node.type === "html" && parent?.children) {
        const text: MdNode = { type: "text", value: node.value ?? "" };
        parent.children[index] =
          parent.type === "root" ? { type: "paragraph", children: [text] } : text;
        return;
      }
      node.children?.forEach((child, i) => walk(child, node, i));
    };
    walk(tree, null, 0);
  };
}

/** Carry the fence meta string (`title="x"`) through sanitization as a data attribute. */
function rehypeFenceMeta() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.tagName === "code" && node.data?.meta) {
        node.properties = { ...node.properties, dataMeta: node.data.meta };
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "dataMeta"],
  },
};

/** Fence meta such as `title="settings.json"` -> "settings.json". */
export function parseFenceTitle(meta: string | undefined): string | null {
  if (!meta) return null;
  const m = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(meta);
  const title = m?.[1] ?? m?.[2] ?? m?.[3];
  return title && title.length > 0 ? title : null;
}

/** Accessible name for a table: its caption, else its first header cell, else "data". */
function tableName(node: HastNode | undefined): string {
  const find = (n: HastNode | undefined, tags: string[]): HastNode | null => {
    if (!n) return null;
    if (n.type === "element" && n.tagName && tags.includes(n.tagName)) return n;
    for (const c of n.children ?? []) {
      const hit = find(c, tags);
      if (hit) return hit;
    }
    return null;
  };
  const el = find(node, ["caption"]) ?? find(node, ["th"]);
  const text = el ? textOf(el).trim() : "";
  return text.length > 0 ? text : "data";
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * Headings inside lesson markdown start at h3 (the page owns h1/h2). The shift is relative to the shallowest heading in
 * the source, so a body written with `###` (the authoring convention) lands on h3 and never skips a level.
 */
function heading(level: number, shift: number) {
  const Tag = `h${Math.min(Math.max(level + shift, 3), 6)}` as "h3" | "h4" | "h5" | "h6";
  const cls =
    level + shift <= 3
      ? "mt-8 mb-3 text-xl font-bold text-fg-strong"
      : "mt-6 mb-2 text-lg font-bold text-fg-strong";
  return function Heading({ children }: { children?: ReactNode }) {
    return <Tag className={cls}>{children}</Tag>;
  };
}

/** Shallowest ATX heading level outside code fences, or null when the source has none. */
export function shallowestHeading(source: string): number | null {
  let min: number | null = null;
  let fence: { char: string; length: number } | null = null;
  for (const line of source.split("\n")) {
    const f = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence === null) {
      // CommonMark: a backtick fence's info string cannot contain a backtick (that would be inline code).
      if (f && !(f[1][0] === "`" && f[2].includes("`"))) {
        fence = { char: f[1][0], length: f[1].length };
        continue;
      }
    } else {
      // The closing fence uses the same character, is at least as long as the opening one, and has nothing after it.
      if (f && f[1][0] === fence.char && f[1].length >= fence.length && f[2].trim() === "") fence = null;
      continue;
    }
    const h = /^ {0,3}(#{1,6})(?:\s|$)/.exec(line);
    if (h && (min === null || h[1].length < min)) min = h[1].length;
  }
  return min;
}

/**
 * The `pre` renderer. A fenced block whose language is `diagram` is handed to `onDiagram` when given (the diagram kit,
 * PRD §17.5); every other fence, and a `diagram` fence with no handler, is a CodeBlock.
 */
function makePre(onDiagram?: (source: string) => ReactNode): Components["pre"] {
  return function Pre({ node }) {
    const codeEl = (node as HastNode | undefined)?.children?.find(
      (c) => c.type === "element" && c.tagName === "code",
    );
    if (!codeEl) return null;
    const classes = codeEl.properties?.className;
    const lang = Array.isArray(classes)
      ? String(classes.find((c) => String(c).startsWith("language-")) ?? "").replace("language-", "")
      : "";
    if (lang === "diagram" && onDiagram) return <>{onDiagram(textOf(codeEl))}</>;
    const meta = typeof codeEl.properties?.dataMeta === "string" ? codeEl.properties.dataMeta : undefined;
    return <CodeBlock code={textOf(codeEl)} language={lang || undefined} title={parseFenceTitle(meta) ?? undefined} />;
  };
}

const components: Components = {
  p: ({ children }) => (
    <p className="my-4 max-w-[var(--fm-measure)] text-prose text-fg [overflow-wrap:anywhere]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-4 max-w-[var(--fm-measure)] list-disc space-y-1 pl-6 text-prose text-fg [overflow-wrap:anywhere]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 max-w-[var(--fm-measure)] list-decimal space-y-1 pl-6 text-prose text-fg [overflow-wrap:anywhere]">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-border pl-4 text-fg-muted">{children}</blockquote>
  ),
  hr: () => <hr className="my-6 border-divider" />,
  // The scroll container is a labelled, focusable region so keyboard users can scroll it.
  table: ({ node, children }) => (
    <div
      role="region"
      tabIndex={0}
      aria-label={`Table: ${tableName(node as HastNode | undefined)}`}
      className="my-4 overflow-x-auto"
    >
      <table className="w-full border-collapse text-left text-base">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-divider px-3 py-2 font-bold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border-subtle px-3 py-2">{children}</td>,
  img: ({ src, alt }) =>
    typeof src === "string" && src.length > 0 ? (
      // eslint-disable-next-line @next/next/no-img-element -- lesson images are authored external/relative URLs
      <img src={src} alt={alt ?? ""} className="my-4 h-auto max-w-full rounded-lg" />
    ) : null,
  code: ({ children, className }) => (
    <code className={className ? className : INLINE_CODE_CLASS}>{children}</code>
  ),
  pre: makePre(),
  a: ({ href, children }: ComponentProps<"a">) => {
    if (!href) return <span>{children}</span>;
    const cls = "text-link underline underline-offset-2 hover:text-primary-hover";
    if (isExternal(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
          {children}
          <ExternalLink size={12} aria-hidden="true" className="ml-0.5 inline align-baseline" />
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      );
    }
    if (href.startsWith("/") && !href.startsWith("//")) {
      return (
        <Link href={href} className={cls}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  },
};

const remarkPlugins: Options["remarkPlugins"] = [remarkGfm, remarkHtmlAsText];
const rehypePlugins: Options["rehypePlugins"] = [rehypeFenceMeta, [rehypeSanitize, schema]];

/**
 * `diagramContext` (for logs, e.g. "lesson l1-first-session") turns on `diagram` fences. Only the Concept body passes it:
 * a diagram anywhere else renders as the YAML code block it is, and the seed rejects it there (DG-7).
 */
export function Markdown({ source, diagramContext }: { source: string; diagramContext?: string }) {
  const shift = 3 - (shallowestHeading(source) ?? 3);
  const diagramState = { count: 0, seen: new Set<string>() };
  const withHeadings: Components = {
    ...components,
    ...(diagramContext
      ? {
          pre: makePre((src) => (
            <LessonDiagram source={src} index={++diagramState.count} context={diagramContext} seenIds={diagramState.seen} />
          )),
        }
      : {}),
    h1: heading(1, shift),
    h2: heading(2, shift),
    h3: heading(3, shift),
    h4: heading(4, shift),
    h5: heading(5, shift),
    h6: heading(6, shift),
  };
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={withHeadings}>
      {source}
    </ReactMarkdown>
  );
}
