"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useSlashCommands } from "./SlashCommandProvider";
import { playChime } from "./NotificationProvider";
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

export function TodoList() {
  const { todos, toggleTodo } = useSlashCommands();
  const [now, setNow] = useState(() => new Date());

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
  // Sort rank: P0 (0) → queen (1) → regular P1 (2)
  const sortRank = (t: typeof visibleTodos[number]) =>
    t.priority === 0 ? 0 : t.queen ? 1 : 2;
  const sortedTodos = [...visibleTodos].sort((a, b) => {
    const ra = sortRank(a);
    const rb = sortRank(b);
    if (ra !== rb) return ra - rb;
    // Within the same rank, deadline tasks come before non-deadline tasks
    const aHas = a.deadline ? 0 : 1;
    const bHas = b.deadline ? 0 : 1;
    return aHas - bHas;
  });

  if (sortedTodos.length === 0) return null;

  // Divider goes between queen/P0 tasks and regular P1 tasks
  const hasAboveFold = sortedTodos.some((t) => t.priority === 0 || t.queen);
  const hasBelowFold = sortedTodos.some((t) => t.priority !== 0 && !t.queen);
  const showDivider = hasAboveFold && hasBelowFold;

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

          const itemClasses = [
            styles.item,
            isOverdue ? styles.breathing : "",
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
              <li className={itemClasses}>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => handleToggle(todo.id, todo.done)}
                    className={styles.checkbox}
                  />
                  <span
                    className={
                      todo.done
                        ? styles.textDone
                        : isOverdue
                          ? styles.textOverdue
                          : todo.blocked
                            ? styles.textBlocked
                            : styles.text
                    }
                  >
                    {todo.queen && "👑 "}{todo.text}
                  </span>
                  {todo.blocked && !todo.done && (
                    <span className={styles.blockedBadge}>blocked</span>
                  )}
                </label>
                {deadline && msUntilDeadline !== null && !todo.done && (
                  <span
                    className={
                      isOverdue ? styles.countdownOverdue : styles.countdown
                    }
                  >
                    {formatCountdown(msUntilDeadline)}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </section>
  );
}
