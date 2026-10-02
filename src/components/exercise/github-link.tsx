import { ExternalLink } from "lucide-react";
import { exerciseFolderUrl } from "@/lib/site";

/** "View on GitHub" link to an exercise folder. 44px target, external-link icon, opens in a new tab. */
export function ExerciseGithubLink({ repoPath, className = "" }: { repoPath: string; className?: string }) {
  return (
    <a
      href={exerciseFolderUrl(repoPath)}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative z-10 inline-flex min-h-11 items-center gap-1 text-link underline underline-offset-2 hover:decoration-2 ${className}`}
    >
      View on GitHub
      <ExternalLink size={14} aria-hidden="true" />
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}
