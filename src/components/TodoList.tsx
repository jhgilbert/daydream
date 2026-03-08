"use client";

import { useSlashCommands } from "./SlashCommandProvider";
import styles from "./TodoList.module.css";

export function TodoList() {
  const { todos, toggleTodo } = useSlashCommands();

  if (todos.length === 0) return null;

  return (
    <section className={styles.container}>
      <h2 className={styles.heading}>Todos</h2>
      <ul className={styles.list}>
        {todos.map((todo) => (
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
        ))}
      </ul>
    </section>
  );
}
