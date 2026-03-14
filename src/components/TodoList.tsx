"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useSlashCommands, type TodoItem } from "./SlashCommandProvider";
import { playChime } from "./NotificationProvider";
import { NoteEditor, isNoteEmpty } from "./NoteEditor";
import styles from "./TodoList.module.css";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.abs(Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (ms < 0) {
    // Overdue
    if (hours > 0) return `${hours}h ${minutes}m overdue`;
    return `${minutes}m overdue`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** Priority bucket rank: P0 (0) → queen (1) → regular P1 (2) → completed (3) */
const sortRank = (t: TodoItem) =>
  t.done ? 3 : t.priority === 0 ? 0 : t.queen ? 1 : 2;

export function TodoList() {
  const { todos, toggleTodo, updateTodoNotes, reorderTodos } = useSlashCommands();
  const [now, setNow] = useState(() => new Date());

  // Accordion: which todo's notes are expanded
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track whether the editor has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Drag-and-drop state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragRank, setDragRank] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleToggle = useCallback(
    (id: string, currentlyDone: boolean) => {
      toggleTodo(id);
      if (!currentlyDone) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    },
    [toggleTodo],
  );

  const handleTextClick = useCallback(
    (id: string) => {
      if (expandedId === id) {
        // Only collapse if no unsaved changes
        if (!hasUnsavedChanges) {
          setExpandedId(null);
        }
      } else {
        // Don't switch if current editor has unsaved changes
        if (!hasUnsavedChanges) {
          setExpandedId(id);
        }
      }
    },
    [expandedId, hasUnsavedChanges]
  );

  const handleNoteSave = useCallback(
    async (id: string, html: string) => {
      const success = await updateTodoNotes(id, html);
      if (success) {
        setExpandedId(null);
        setHasUnsavedChanges(false);
      }
    },
    [updateTodoNotes]
  );

  const handleNoteCancel = useCallback(() => {
    setExpandedId(null);
    setHasUnsavedChanges(false);
  }, []);

  // Track which todos have already chimed for overdue state
  const chimedOverdueRef = useRef<Set<string>>(new Set());

  // Tick every 30s so countdowns update
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Play chime when a todo first becomes overdue
  useEffect(() => {
    let shouldChime = false;
    for (const todo of todos) {
      if (todo.done || todo.deleted || !todo.deadline) continue;
      const msLeft = new Date(todo.deadline).getTime() - now.getTime();
      if (msLeft < 0 && !chimedOverdueRef.current.has(todo.id)) {
        chimedOverdueRef.current.add(todo.id);
        shouldChime = true;
      }
    }
    if (shouldChime) playChime();
  }, [now, todos]);

  const visibleTodos = todos.filter((t) => !t.deleted);
  const sortedTodos = [...visibleTodos].sort((a, b) => {
    const ra = sortRank(a);
    const rb = sortRank(b);
    if (ra !== rb) return ra - rb;
    // Completed bucket: most recently completed first
    if (ra === 3) {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    }
    // Within the same rank, sort by sortOrder then createdAt
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const aHas = a.deadline ? 0 : 1;
    const bHas = b.deadline ? 0 : 1;
    return aHas - bHas;
  });

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, todo: TodoItem) => {
      setDragId(todo.id);
      setDragRank(sortRank(todo));
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, todo: TodoItem) => {
      if (dragRank === null || sortRank(todo) !== dragRank) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(todo.id);
    },
    [dragRank],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, dropTodo: TodoItem) => {
      e.preventDefault();
      if (!dragId || dragRank === null || sortRank(dropTodo) !== dragRank) return;

      const bucketTodos = sortedTodos.filter((t) => sortRank(t) === dragRank);
      const fromIndex = bucketTodos.findIndex((t) => t.id === dragId);
      const toIndex = bucketTodos.findIndex((t) => t.id === dropTodo.id);

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        setDragId(null);
        setDragRank(null);
        setDragOverId(null);
        return;
      }

      const reordered = [...bucketTodos];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      reorderTodos(reordered.map((t) => t.id));

      setDragId(null);
      setDragRank(null);
      setDragOverId(null);
    },
    [dragId, dragRank, sortedTodos, reorderTodos],
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragRank(null);
    setDragOverId(null);
  }, []);

  if (sortedTodos.length === 0) return null;

  // Divider goes between queen/P0 tasks and regular P1 tasks
  const hasAboveFold = sortedTodos.some((t) => !t.done && (t.priority === 0 || t.queen));
  const hasBelowFold = sortedTodos.some((t) => !t.done && t.priority !== 0 && !t.queen);
  const showDivider = hasAboveFold && hasBelowFold;

  const isDragging = dragId !== null;

  return (
    <section className={styles.container}>
      <h2 className={styles.heading}>Todos</h2>
      <ul className={styles.list}>
        {sortedTodos.map((todo, i) => {
          const deadline = todo.deadline ? new Date(todo.deadline) : null;
          const msUntilDeadline = deadline
            ? deadline.getTime() - now.getTime()
            : null;
          const isOverdue =
            deadline !== null &&
            msUntilDeadline !== null &&
            msUntilDeadline < 0 &&
            !todo.done;

          const rank = sortRank(todo);
          const inDragBucket = dragRank !== null && rank === dragRank;
          const outsideDragBucket = isDragging && !inDragBucket;
          const isBeingDragged = todo.id === dragId;
          const isDropTarget = todo.id === dragOverId;

          const itemClasses = [
            styles.item,
            isOverdue ? styles.breathing : "",
            outsideDragBucket ? styles.dimmed : "",
            isBeingDragged ? styles.dragging : "",
            isDropTarget ? styles.dropTarget : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <React.Fragment key={todo.id}>
              {showDivider &&
                i > 0 &&
                sortRank(todo) === 2 &&
                sortRank(sortedTodos[i - 1]) < 2 && (
                  <li key="divider" className={styles.divider} aria-hidden />
                )}
              <li
                className={itemClasses}
                draggable={!todo.done}
                onDragStart={(e) => handleDragStart(e, todo)}
                onDragOver={(e) => handleDragOver(e, todo)}
                onDrop={(e) => handleDrop(e, todo)}
                onDragEnd={handleDragEnd}
              >
                <div className={styles.row}>
                  <div className={styles.label}>
                    <input
                      type="checkbox"
                      checked={todo.done}
                      onChange={() => handleToggle(todo.id, todo.done)}
                      className={styles.checkbox}
                    />
                    <span
                      className={[
                        todo.done
                          ? styles.textDone
                          : isOverdue
                            ? styles.textOverdue
                            : todo.blocked
                              ? styles.textBlocked
                              : styles.text,
                        styles.textClickable,
                      ].join(" ")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTextClick(todo.id);
                      }}
                    >
                      {todo.queen && "👑 "}{todo.text}
                      {!isNoteEmpty(todo.notes) && (
                        <span className={styles.noteIndicator}>📝</span>
                      )}
                    </span>
                    {todo.blocked && !todo.done && (
                      <span className={styles.blockedBadge}>blocked</span>
                    )}
                  </div>
                  {deadline && msUntilDeadline !== null && !todo.done && (
                    <span
                      className={
                        isOverdue ? styles.countdownOverdue : styles.countdown
                      }
                    >
                      {formatCountdown(msUntilDeadline)}
                    </span>
                  )}
                </div>
                {expandedId === todo.id && (
                  <NoteEditor
                    initialValue={todo.notes ?? ""}
                    onSave={(html) => handleNoteSave(todo.id, html)}
                    onCancel={handleNoteCancel}
                    onDirtyChange={setHasUnsavedChanges}
                  />
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </section>
  );
}
