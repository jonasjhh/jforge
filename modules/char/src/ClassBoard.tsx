import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRef, useState, type DragEvent } from "react";
import {
  linkProblem,
  withSource,
  withoutLinks,
  withoutSource,
  type Archetype,
  type Library,
} from "../shared";
import { boardPlaces, freeSpot, trayClasses, type Places } from "./board";
import { loadPlaces, savePlaces } from "./storage";

interface ClassBoardProps {
  library: Library;
  onUpdate: (change: (library: Library) => Library) => void;
  /** Opens a class in the Classes tab. */
  onOpenClass: (id: string) => void;
}

type ClassNode = Node<{ name: string; base: boolean }, "class">;

/** The drag data a tray class carries onto the board. */
const DRAG_TYPE = "application/x-jforge-class";

const name = (a: Archetype | undefined) => a?.name || "(unnamed)";

/** A class on the board: links come in on the left and go out on the right. */
function ClassCard({ data }: NodeProps<ClassNode>) {
  return (
    <div className="class-card">
      <Handle type="target" position={Position.Left} />
      <span className="class-card-name">{data.name}</span>
      {data.base && <span className="class-card-note">base class</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { class: ClassCard };

/**
 * The class graph as a board: classes are placed by dragging them from the
 * tray, and linked by dragging from one's right handle to another's left.
 */
export function ClassBoard(props: ClassBoardProps) {
  return (
    <ReactFlowProvider>
      <Board {...props} />
    </ReactFlowProvider>
  );
}

function Board({ library, onUpdate, onOpenClass }: ClassBoardProps) {
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [places, setPlacesState] = useState<Places>(loadPlaces);
  // What React Flow measured and which card or link is picked; kept apart
  // from the library, which the cards and links are made from.
  const [measured, setMeasured] = useState<Record<string, Node["measured"]>>(
    {},
  );
  const [picked, setPicked] = useState<
    { node: string } | { edge: string } | null
  >(null);
  const [message, setMessage] = useState("");

  const setPlaces = (change: (places: Places) => Places) =>
    setPlacesState((old) => {
      const next = change(old);
      savePlaces(next);
      return next;
    });

  const onBoard = boardPlaces(library, places);
  const tray = trayClasses(library, places);
  const byId = (id: string) => library.archetypes.find((a) => a.id === id);

  const nodes: ClassNode[] = Object.entries(onBoard).map(([id, position]) => {
    const archetype = byId(id);
    return {
      id,
      type: "class",
      position,
      measured: measured[id],
      selected: picked !== null && "node" in picked && picked.node === id,
      data: {
        name: name(archetype),
        base: (archetype?.comesFrom ?? []).length === 0,
      },
    };
  });
  const edges: Edge[] = library.archetypes.flatMap((target) =>
    (target.comesFrom ?? [])
      .filter((source) => onBoard[source] && onBoard[target.id])
      .map((source) => {
        const id = `${source}->${target.id}`;
        return {
          id,
          source,
          target: target.id,
          selected: picked !== null && "edge" in picked && picked.edge === id,
          // The marker takes a colour, not a CSS variable: --text-muted.
          markerEnd: { type: MarkerType.ArrowClosed, color: "#9fb0b0" },
        };
      }),
  );

  const onNodesChange = (changes: NodeChange<ClassNode>[]) => {
    const moved = applyNodeChanges(
      changes.filter((c) => c.type !== "remove"),
      nodes,
    );
    setMeasured(Object.fromEntries(moved.map((n) => [n.id, n.measured])));
    if (changes.some((c) => c.type === "position" && c.position)) {
      setPlaces((old) => ({
        ...old,
        ...Object.fromEntries(moved.map((n) => [n.id, n.position])),
      }));
    }
    for (const c of changes) {
      if (c.type !== "select") continue;
      if (c.selected) setPicked({ node: c.id });
      else setPicked((p) => (p && "node" in p && p.node === c.id ? null : p));
    }
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    for (const c of changes) {
      if (c.type !== "select") continue;
      if (c.selected) setPicked({ edge: c.id });
      else setPicked((p) => (p && "edge" in p && p.edge === c.id ? null : p));
    }
  };

  const link = ({ source, target }: Connection) => {
    const problem = linkProblem(library, source, target);
    if (problem) {
      setMessage(problem);
      return;
    }
    onUpdate((lib) => {
      const to = lib.archetypes.find((a) => a.id === target);
      if (!to) return lib;
      const next = withSource(lib, to, source);
      return {
        ...lib,
        archetypes: lib.archetypes.map((a) => (a.id === target ? next : a)),
      };
    });
    setMessage(`${name(byId(target))} now comes from ${name(byId(source))}.`);
  };

  const unlink = (source: string, target: string) => {
    onUpdate((lib) => ({
      ...lib,
      archetypes: lib.archetypes.map((a) =>
        a.id === target ? withoutSource(a, source) : a,
      ),
    }));
    setPicked(null);
    setMessage(
      `${name(byId(target))} no longer comes from ${name(byId(source))}.`,
    );
  };

  const takeOff = (id: string) => {
    onUpdate((lib) => withoutLinks(lib, id));
    setPlaces((old) => {
      const next = { ...old };
      delete next[id];
      return next;
    });
    setPicked(null);
    setMessage(`${name(byId(id))} is back in the tray, with no links.`);
  };

  /** Puts a tray class on the board at a point on screen. */
  const place = (id: string, x: number, y: number, spread = false) => {
    const at = flow.screenToFlowPosition({ x, y });
    const near = { x: at.x - 80, y: at.y - 25 };
    const spot = spread ? freeSpot(near, Object.values(onBoard)) : near;
    setPlaces((old) => ({ ...old, [id]: spot }));
    setMessage(`${name(byId(id))} is on the board.`);
  };

  /** Puts a tray class at a free spot near the middle of the board. */
  const placeInMiddle = (id: string) => {
    const box = wrapper.current?.getBoundingClientRect();
    place(
      id,
      box ? box.left + box.width / 2 : 0,
      box ? box.top + box.height / 2 : 0,
      true,
    );
  };

  const onDrop = (e: DragEvent) => {
    const id = e.dataTransfer.getData(DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    place(id, e.clientX, e.clientY);
  };

  const pickedNode = picked && "node" in picked ? byId(picked.node) : null;
  const pickedEdge =
    picked && "edge" in picked
      ? edges.find((edge) => edge.id === picked.edge)
      : undefined;

  return (
    <div className="paths">
      <section className="panel tray" aria-label="Tray">
        <h2>Tray</h2>
        {tray.length === 0 ? (
          <p className="muted small">Every class is on the board.</p>
        ) : (
          <>
            <p className="muted small">
              Drag a class onto the board, or tap it to place it.
            </p>
            <ul className="known" aria-label="Classes not on the board">
              {tray.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="tray-class"
                    draggable
                    aria-label={`Place ${name(a)}`}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, a.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => placeInMiddle(a.id)}
                  >
                    {name(a)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div
        className="board"
        ref={wrapper}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={onDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={link}
          onNodesDelete={(deleted) => deleted.forEach((n) => takeOff(n.id))}
          onEdgesDelete={(deleted) =>
            deleted.forEach((e) => unlink(e.source, e.target))
          }
          onPaneClick={() => setPicked(null)}
          colorMode="dark"
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          minZoom={0.3}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
        {nodes.length === 0 && (
          <p className="board-empty muted">
            The board is empty. Place a class from the tray to start a tree.
          </p>
        )}
      </div>

      <section className="panel board-pick" aria-label="Picked">
        {pickedNode ? (
          <>
            <h2>{name(pickedNode)}</h2>
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                onClick={() => onOpenClass(pickedNode.id)}
              >
                Edit {name(pickedNode)}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => takeOff(pickedNode.id)}
              >
                Take off the board
              </button>
            </div>
            <p className="muted small">
              Taking a class off the board removes its links. The class itself
              stays.
            </p>
          </>
        ) : pickedEdge ? (
          <>
            <h2>
              {name(byId(pickedEdge.source))} → {name(byId(pickedEdge.target))}
            </h2>
            <button
              type="button"
              className="danger"
              onClick={() => unlink(pickedEdge.source, pickedEdge.target)}
            >
              Remove link
            </button>
          </>
        ) : (
          <p className="muted small">
            Drag from a class's right dot to another class's left dot to link
            them: the second then comes from the first, and any one class it
            comes from is enough. Links go forward only. Tap a class or a link
            to change it. The layout is kept on this device only; the links are
            part of the library.
          </p>
        )}
        <p className="muted small" role="status">
          {message}
        </p>
      </section>
    </div>
  );
}
