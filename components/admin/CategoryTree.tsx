"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, ChevronDown, GripVertical, Eye, EyeOff, Star } from "lucide-react";
import { deleteCategory, reorderCategories } from "@/app/admin/(dashboard)/categories/actions";
import type { CategoryWithChildren } from "@/types/category";

interface CategoryTreeProps {
  nodes: CategoryWithChildren[];
}

/**
 * Drag-and-drop reorders SIBLINGS only — each parent's children are their own independent
 * DndContext, so dragging an item out of its group isn't structurally possible (dnd-kit's
 * collision detection never sees items outside the active drag's own context). Moving a
 * category to a DIFFERENT parent is a deliberate field edit on its detail page instead of a
 * drag gesture — cross-tree drag-and-drop is easy to get subtly wrong (which index does a
 * drop between two different parents' items even mean?), and this app doesn't need it to
 * satisfy "unlimited nesting" or "drag-and-drop ordering."
 */
export function CategoryTree({ nodes }: CategoryTreeProps) {
  return (
    <div className="border border-border bg-luxe-white">
      <CategoryGroup parentId={null} nodes={nodes} depth={0} />
    </div>
  );
}

function CategoryGroup({ parentId, nodes, depth }: { parentId: string | null; nodes: CategoryWithChildren[]; depth: number }) {
  const [items, setItems] = useState(nodes);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    const previous = items;
    setItems(reordered);
    startTransition(async () => {
      const result = await reorderCategories(parentId, reordered.map((i) => i.id));
      if (result?.error) {
        setError(result.error);
        setItems(previous);
      } else {
        setError(null);
      }
    });
  }

  if (items.length === 0) {
    return depth === 0 ? <p className="p-6 text-sm text-luxe-gray-dark">No categories yet.</p> : null;
  }

  return (
    <div>
      {error ? (
        <p className="border-b border-destructive/40 bg-destructive/5 px-4 py-2 text-xs text-destructive">{error}</p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((node) => (
            <CategoryRow key={node.id} node={node} depth={depth} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function CategoryRow({ node, depth }: { node: CategoryWithChildren; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  function handleDelete() {
    if (!window.confirm(`Delete "${node.name}"? This can't be undone.`)) return;
    startTransition(async () => {
      const result = await deleteCategory(node.id);
      if (result?.error) setDeleteError(result.error);
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-3" style={{ paddingLeft: `${16 + depth * 24}px` }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab text-luxe-gray-dark active:cursor-grabbing"
          aria-label={`Drag to reorder ${node.name}`}
        >
          <GripVertical className="size-4" strokeWidth={1.5} />
        </button>
        {node.children.length > 0 ? (
          <button type="button" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronDown className="size-4" strokeWidth={1.5} /> : <ChevronRight className="size-4" strokeWidth={1.5} />}
          </button>
        ) : (
          <span className="size-4" />
        )}
        {node.image ? (
          <div className="relative size-8 shrink-0 overflow-hidden bg-luxe-gray-light">
            <Image src={node.image.src} alt={node.image.alt} fill className="object-cover" />
          </div>
        ) : null}
        <Link href={`/admin/categories/${node.id}`} className="flex-1 truncate text-sm hover:underline">
          {node.name}
          <span className="ml-2 text-xs text-luxe-gray-dark">/{node.slug}</span>
        </Link>
        {node.isFeatured ? <Star className="size-3.5 shrink-0 text-amber-600" strokeWidth={1.5} aria-label="Featured" /> : null}
        {node.isVisible ? (
          <Eye className="size-3.5 shrink-0 text-luxe-gray-dark" strokeWidth={1.5} aria-label="Visible" />
        ) : (
          <EyeOff className="size-3.5 shrink-0 text-destructive" strokeWidth={1.5} aria-label="Hidden" />
        )}
        <span className="w-20 shrink-0 text-right text-xs text-luxe-gray-dark">{node.productCount ?? 0} products</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="shrink-0 text-xs font-medium tracking-[0.05em] text-destructive uppercase disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {deleteError ? (
        <p className="px-4 pb-2 text-xs text-destructive" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          {deleteError}
        </p>
      ) : null}
      {expanded && node.children.length > 0 ? (
        <div className="border-t border-border bg-luxe-gray-light/20">
          <CategoryGroup parentId={node.id} nodes={node.children} depth={depth + 1} />
        </div>
      ) : null}
    </div>
  );
}
