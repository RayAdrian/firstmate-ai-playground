import { Composition } from "remotion";
import { ParallelWorktrees, parallelWorktreesData } from "./parallel-worktrees/ParallelWorktrees.tsx";
import { TldrVideo } from "./tldr/TldrVideo.tsx";
import { calculateMetadata } from "./tldr/calc.ts";
import type { TldrProps } from "./tldr/calc.ts";
import { GatedMergePipelines, gatedMergeData } from "./gated-merge-pipelines/GatedMergePipelines.tsx";

// Composition ids equal the media ids (and the folder names under src/). Add new items here and in render.ts's discovery (automatic).
export const RemotionRoot = () => (
  <>
    {[
      { data: parallelWorktreesData, component: ParallelWorktrees },
      { data: gatedMergeData, component: GatedMergePipelines },
    ].map(({ data, component }) => (
      <Composition
        key={data.id}
        id={data.id}
        component={component}
        durationInFrames={Math.round(data.duration_s * data.fps)}
        fps={data.fps}
        width={data.width}
        height={data.height}
      />
    ))}
    {/* One TL;DR template for every lesson (PRD §19.5). Real props come from render.ts --tldr; duration and the plan from calculateMetadata. */}
    <Composition
      id="tldr"
      component={TldrVideo}
      durationInFrames={900}
      fps={30}
      width={1280}
      height={720}
      calculateMetadata={calculateMetadata}
      defaultProps={tldrSampleProps}
    />
  </>
);

const tldrSampleProps: TldrProps = {
  slug: "sample",
  title: "Your first agent session",
  tldr: {
    points: [
      "An agent is a model in a loop: ask, edit, approve, verify.",
      "Approval prompts are your brake. Learn what triggers them before you speed up.",
      "Commit before you start, so `git` can undo anything the agent did.",
    ],
    try_this: { all: { kind: "command", text: "claude --version && codex --version" } },
  },
};
