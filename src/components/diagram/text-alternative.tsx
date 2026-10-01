import type { ReactElement } from "react";
import type { BoundaryDiagram, Diagram, FlowDiagram, LanesDiagram, StackDiagram } from "@/lib/contracts/diagram";

// "Diagram as text" (DG-4): every string is generated from the diagram data, never authored separately.
// Plain React text, no markdown; `\n` in a label reads as a space; "(key)" and "(risk)" are spelled out.

const flat = (s: string): string => s.split("\n").join(" ");
const nodeText = (n: { label: string; sub?: string | undefined; emphasis?: true | undefined }): string =>
  `${flat(n.label)}${n.sub ? `: ${n.sub}` : ""}${n.emphasis ? " (key)" : ""}`;

function Flow({ d }: { d: FlowDiagram }): ReactElement {
  const num = new Map(d.steps.map((s, i) => [s.id, i + 1]));
  const label = new Map(d.steps.map((s) => [s.id, flat(s.label)]));
  return (
    <>
      <ol className="list-decimal space-y-1 pl-6">
        {d.steps.map((s, i) => (
          <li key={s.id}>
            {nodeText(s)}
            {s.next && i < d.steps.length - 1 ? ` Arrow to step ${i + 2}: ${s.next}.` : ""}
          </li>
        ))}
      </ol>
      {d.loops.map((l, i) => (
        <p key={`l${i}`} className="mt-2">
          {`From step ${num.get(l.from)} (${label.get(l.from)}) back to step ${num.get(l.to)} (${label.get(l.to)}): ${l.label}.`}
        </p>
      ))}
      {d.exits.map((x, i) => (
        <p key={`x${i}`} className="mt-2">
          {`From step ${num.get(x.from)} (${label.get(x.from)}), exit "${x.label}": ${x.text}${x.style === "risk" ? " (risk)" : ""}.`}
        </p>
      ))}
    </>
  );
}

function Stack({ d }: { d: StackDiagram }): ReactElement {
  return (
    <>
      <p>{`Ordered from ${d.axis.low} to ${d.axis.high}.`}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        {d.layers.map((l) => (
          <li key={l.id}>{nodeText(l)}</li>
        ))}
      </ol>
    </>
  );
}

type Zone = BoundaryDiagram["zones"][number];
function ZoneItem({ z }: { z: Omit<Zone, "zones"> & { zones?: Zone["zones"] } }): ReactElement {
  return (
    <li>
      {z.label}
      {(z.items.length > 0 || (z.zones?.length ?? 0) > 0) && (
        <ul className="list-disc space-y-1 pl-6">
          {z.items.map((it) => (
            <li key={it.id}>{nodeText(it)}</li>
          ))}
          {z.zones?.map((c) => <ZoneItem key={c.id} z={c} />)}
        </ul>
      )}
    </li>
  );
}

function Boundary({ d }: { d: BoundaryDiagram }): ReactElement {
  const labels = new Map<string, string>();
  const visit = (z: Omit<Zone, "zones"> & { zones?: Zone["zones"] }) => {
    labels.set(z.id, flat(z.label));
    z.items.forEach((it) => labels.set(it.id, flat(it.label)));
    z.zones?.forEach(visit);
  };
  d.zones.forEach(visit);
  return (
    <>
      <ul className="list-disc space-y-1 pl-6">
        {d.zones.map((z) => (
          <ZoneItem key={z.id} z={z} />
        ))}
      </ul>
      {d.crossings.length > 0 && (
        <>
          <p className="mt-2">Crossings:</p>
          <ol className="list-decimal space-y-1 pl-6">
            {d.crossings.map((c, i) => (
              <li key={i}>{`${labels.get(c.from)} to ${labels.get(c.to)}: ${c.label}${c.style === "risk" ? " (risk)" : ""}.`}</li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

function Lanes({ d }: { d: LanesDiagram }): ReactElement {
  const laneIndex = new Map(d.lanes.map((l, i) => [l.id, i]));
  const laneLabel = new Map(d.lanes.map((l) => [l.id, l.label]));
  const stepLabel = new Map(d.steps.map((s) => [s.id, flat(s.label)]));
  const cols = [...new Set([...d.steps.map((s) => s.col), ...(d.marker ? [d.marker.col] : [])])].sort((a, b) => a - b);
  const items: { key: string; text: string }[] = [];
  for (const col of cols) {
    if (d.marker?.col === col) {
      items.push({ key: `m${col}`, text: `Time ${col}, event: ${d.marker.label}${d.marker.style === "risk" ? " (risk)" : ""}` });
    }
    d.steps
      .filter((s) => s.col === col)
      .sort((a, b) => (laneIndex.get(a.lane) ?? 0) - (laneIndex.get(b.lane) ?? 0))
      .forEach((s) =>
        items.push({
          key: s.id,
          text: `Time ${col}, ${laneLabel.get(s.lane)}: ${nodeText(s)}${s.style === "risk" ? " (risk)" : ""}`,
        }),
      );
  }
  return (
    <>
      <p>{`Lanes: ${d.lanes.map((l) => l.label).join(", ")}.`}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        {items.map((i) => (
          <li key={i.key}>{i.text}</li>
        ))}
      </ol>
      {d.handoffs.length > 0 && (
        <>
          <p className="mt-2">Handoffs:</p>
          <ol className="list-decimal space-y-1 pl-6">
            {d.handoffs.map((h, i) => (
              <li key={i}>
                {`${stepLabel.get(h.from)} to ${stepLabel.get(h.to)}${h.label ? `: ${h.label}` : ""}${h.style === "risk" ? " (risk)" : ""}.`}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}

/** The panel content of "Diagram as text". */
export function DiagramTextBody({ diagram }: { diagram: Diagram }): ReactElement {
  switch (diagram.type) {
    case "flow":
      return <Flow d={diagram} />;
    case "stack":
      return <Stack d={diagram} />;
    case "boundary":
      return <Boundary d={diagram} />;
    case "lanes":
      return <Lanes d={diagram} />;
  }
}
