import Link from "next/link";
import { HomeLevelProgress } from "./level-progress";

export type HomeLevel = { number: number; title: string; slugs: string[] };

/**
 * Where I am (DESIGN 6.1). One markup for every width: a divided list at 360, `grid-cols-2` at md,
 * `grid-cols-5` at lg. The stretched link reads "Level 2 Context engineering" to assistive tech
 * while the visible form is the short "L2".
 */
export function LevelCards({ levels }: { levels: readonly HomeLevel[] }) {
  return (
    <ul className="grid divide-y divide-border-subtle rounded-card bg-surface md:grid-cols-2 md:gap-4 md:divide-y-0 md:bg-transparent lg:grid-cols-5 dark:border dark:border-border dark:md:border-0">
      {levels.map((level) => (
        <li
          key={level.number}
          className="relative p-4 md:rounded-card md:bg-surface md:p-5 md:dark:border md:dark:border-border has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-solid has-[a:focus-visible]:outline-focus has-[a:focus-visible]:-outline-offset-2 md:hover:shadow-md"
        >
          <h3 className="text-base font-bold text-fg-strong [overflow-wrap:anywhere]">
            <Link
              href={`/curriculum#level-${level.number}`}
              className="after:absolute after:inset-0 hover:underline focus-visible:outline-none"
            >
              <span aria-hidden="true" className="mr-2 text-link">
                L{level.number}
              </span>
              <span className="sr-only">Level {level.number}</span> {level.title}
            </Link>
          </h3>
          <HomeLevelProgress level={level.number} slugs={level.slugs} />
        </li>
      ))}
    </ul>
  );
}
