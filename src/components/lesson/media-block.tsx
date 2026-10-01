import type { LessonMediaItem } from "./server/media";

/**
 * "Watch" block (PRD §15 MD-1/MD-2). Server component: native video, no JS. No autoplay, preload none,
 * captions on by default, aspect ratio reserved from the manifest so nothing shifts. Renders nothing for no items.
 */
export function MediaBlock({ items }: { items: LessonMediaItem[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map(({ manifest, videoUrl, posterUrl, captionsUrl, transcript }) => {
        const headingId = `watch-${manifest.id}`;
        return (
          <section
            key={manifest.id}
            aria-labelledby={headingId}
            data-testid="media-block"
            className="my-8 rounded-card bg-surface p-4 md:p-5 dark:border dark:border-border"
          >
            <h3 id={headingId} className="mb-3 text-lg font-bold text-fg-strong">
              Watch: {manifest.title}
            </h3>
            <video
              controls
              preload="none"
              playsInline
              poster={posterUrl}
              src={videoUrl}
              width={manifest.width}
              height={manifest.height}
              style={{ aspectRatio: `${manifest.width} / ${manifest.height}` }}
              className="block h-auto w-full rounded-card bg-canvas focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2"
            >
              <track kind="captions" srcLang="en" label="English" src={captionsUrl} default />
            </video>
            <details className="mt-3">
              <summary className="inline-flex min-h-6 cursor-pointer items-center rounded-sm text-sm font-medium text-link hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-focus focus-visible:outline-offset-2 [@media(pointer:coarse)]:min-h-11">
                Transcript
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-base text-fg">{transcript}</p>
            </details>
          </section>
        );
      })}
    </>
  );
}
