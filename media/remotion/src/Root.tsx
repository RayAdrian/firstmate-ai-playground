import { Composition } from "remotion";
import { ParallelWorktrees, parallelWorktreesData } from "./parallel-worktrees/ParallelWorktrees.tsx";
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
  </>
);
