"use client";

import { useId } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * Glisser-déposer des éléments d'une liste du formulaire. SEUL fichier qui connaît dnd-kit :
 * les sections de `FormEditor` ne voient que `SortableList`, `useSortableItem` et `DragHandle`.
 * Le jour où l'on change de bibliothèque, c'est ce fichier — et lui seul — qu'on réécrit.
 *
 * IDENTITÉ DES ÉLÉMENTS : les listes du CV n'ont pas d'identifiant (une compétence est une simple
 * chaîne, et deux éléments peuvent être identiques). On utilise donc l'indice, DÉCALÉ DE 1 :
 * dnd-kit traite l'identifiant `0` comme absent. C'est correct parce que l'ensemble des indices ne
 * change jamais pendant un glissement — seul l'ordre du tableau change, après la dépose.
 */

/** Déplace un élément d'une liste. Ré-export : la logique vient de dnd-kit, rien de maison. */
export { arrayMove as moveItem };

export function SortableList({
  count,
  onMove,
  children,
}: {
  count: number;
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    // Une distance minimale évite qu'un simple clic dans un champ déclenche un glissement.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = Array.from({ length: count }, (_, i) => i + 1);

  // dnd-kit génère sinon un id d'accessibilité via un compteur global, qui diverge entre le
  // rendu serveur et l'hydratation client (une SortableList par section). `useId` de React est
  // stable entre les deux, ce qui évite le warning d'hydratation sur `aria-describedby`.
  const dndId = useId();

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onMove(Number(active.id) - 1, Number(over.id) - 1);
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Props à poser sur l'élément déplaçable ; `handleProps` va sur la poignée, pas sur la carte. */
export function useSortableItem(index: number) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: index + 1,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };
  return { ref: setNodeRef, style, handleProps: { ...attributes, ...listeners }, isDragging };
}

/**
 * La poignée. Seul point de saisie : le reste de la carte laisse la page défiler au doigt
 * (c'est `touch-action: none`, posé sur `.drag-handle` en CSS, qui rend le glissement tactile
 * possible ici et seulement ici).
 */
export function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="drag-handle"
      aria-label="Déplacer l'élément"
      title="Glisser pour déplacer"
      {...props}
    >
      <svg viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="3" r="1.3" />
        <circle cx="7" cy="3" r="1.3" />
        <circle cx="3" cy="8" r="1.3" />
        <circle cx="7" cy="8" r="1.3" />
        <circle cx="3" cy="13" r="1.3" />
        <circle cx="7" cy="13" r="1.3" />
      </svg>
    </button>
  );
}
