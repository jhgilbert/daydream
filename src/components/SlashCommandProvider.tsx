"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface SlashCommand {
  name: string;
  description: string;
  argPlaceholder: string;
  execute: (args: string) => void;
}

interface SlashCommandContextValue {
  todos: TodoItem[];
  toggleTodo: (id: string) => void;
  commands: SlashCommand[];
}

const SlashCommandContext = createContext<SlashCommandContextValue | null>(null);

export function useSlashCommands() {
  const ctx = useContext(SlashCommandContext);
  if (!ctx) {
    throw new Error(
      "useSlashCommands must be used within SlashCommandProvider"
    );
  }
  return ctx;
}

export function SlashCommandProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<TodoItem[]>([]);

  const addTodo = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTodos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: trimmed, done: false },
    ]);
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, []);

  const commands: SlashCommand[] = [
    {
      name: "todo",
      description: "Add an item to the todo list",
      argPlaceholder: "What needs to be done?",
      execute: addTodo,
    },
  ];

  return (
    <SlashCommandContext.Provider value={{ todos, toggleTodo, commands }}>
      {children}
    </SlashCommandContext.Provider>
  );
}
