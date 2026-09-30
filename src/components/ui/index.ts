// Design-system primitives (DESIGN.md §4). Import from "@/components/ui".
// This barrel has no "use client": each file declares its own boundary so Server Components can use
// Card, Badge, Skeleton, EmptyState and CodeBlock without pulling client code.

export { Button, ButtonLink, type ButtonProps } from "./button";
export { buttonClasses, type ButtonSize, type ButtonVariant } from "./button-styles";
export { Card } from "./card";
export { Badge, type BadgeVariant } from "./badge";
export { FilterChip } from "./filter-chip";
export { Tabs, type TabItem } from "./tabs";
// CodeBlock (server-side Shiki, server-only) is NOT exported here so client bundles never pull in shiki:
// import it from "@/components/ui/code-block". PlainCodeBlock is the client-safe twin.
export { CommandLine, PlainCodeBlock } from "./command-line";
export { Checkbox } from "./checkbox";
export { ProgressBar, progressPercent } from "./progress-bar";
export { Skeleton, SkeletonRegion } from "./skeleton";
export { EmptyState } from "./empty-state";
export { Notice, type NoticeLive, type NoticeTone } from "./notice";
export { NotFoundView } from "./not-found-view";
export { announce, LiveRegion } from "./live-region";
export { GlobalNotices, SiteFooter, SkipLink, CONTAINER_CLASS } from "./shell";
export { SiteHeader } from "./site-header";
export { Logo } from "./logo";
export { NAV_ITEMS, isNavActive, type NavItem } from "./nav";
export { cn } from "./cn";
