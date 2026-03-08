"use client";

import { useSlashCommands } from "./SlashCommandProvider";
import styles from "./TodoList.module.css";

export function TodoList() {
  const { todos, toggleTodo } = useSlashCommands();

  const visibleTodos = todos.filter((t) => !t.deleted);
  const sortedTodos = [...visibleTodos].sort((a, b) => a.priority - b.priority);

  if (sortedTodos.length === 0) return null;

  const hasP0 = sortedTodos.some((t) => t.priority === 0);
  const hasP1 = sortedTodos.some((t) => t.priority === 1);
  const showDivider = hasP0 && hasP1;

  return (
    <section className={styles.container}>
      <h2 className={styles.heading}>Todos</h2>
      <ul className={styles.list}>
        {sortedTodos.map((todo, i) => (
          <>
            {showDivider &&
              i > 0 &&
              todo.priority === 1 &&
              sortedTodos[i - 1].priority === 0 && (
                <li key="divider" className={styles.divider} aria-hidden />
              )}
            <li key={todo.id} className={styles.item}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                  className={styles.checkbox}
                />
                <span className={todo.done ? styles.textDone : styles.text}>
                  {todo.text}
                </span>
              </label>
            </li>
          </>
        ))}
      </ul>
    </section>
  );
}
