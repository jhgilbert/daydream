"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNotification } from "./NotificationProvider";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  deleted: boolean;
  blocked: boolean;
  queen: boolean;
  priority: number;
  deadline?: string;
}

export interface Meeting {
  id: string;
  label?: string;
  startTime: Date;
  endTime: Date;
}

export interface ProjectItem {
  id: string;
  name: string;
}

export interface InteractivePrompt {
  key: string;
  question: string;
  required: boolean;
}

export interface SlashCommand {
  name: string;
  description: string;
  argPlaceholder: string;
  execute: (args: string) => void;
  /** When true, show numbered task list as context when this command is active */
  showTaskReference?: boolean;
  /** Optional filter for which tasks to show in the task reference panel */
  filterTaskReference?: (todo: TodoItem) => boolean;
  /** When provided, entering the command with no args starts an interactive flow */
  interactivePrompts?: InteractivePrompt[];
  /** Called with collected answers from the interactive flow */
  executeInteractive?: (answers: Record<string, string>) => void;
}

interface SlashCommandContextValue {
  todos: TodoItem[];
  toggleTodo: (id: string) => void;
  meetings: Meeting[];
  removeMeeting: (id: string) => void;
  projects: ProjectItem[];
  reorderProjects: (fromIndex: number, toIndex: number) => void;
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

/**
 * Get today's date components in America/Chicago timezone.
 */
function getChicagoToday(): { year: number; month: number; day: number } {
  const chicagoFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = chicagoFormatter.formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")!.value),
    month: Number(parts.find((p) => p.type === "month")!.value),
    day: Number(parts.find((p) => p.type === "day")!.value),
  };
}

/**
 * Build a Date in America/Chicago at the given year/month/day/hour/minute.
 */
function buildChicagoDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const tempUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  // Figure out the Chicago offset at that moment by comparing formatted time
  const tempDate = new Date(tempUtc);
  const chicagoTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(tempDate);
  const chicagoHour = Number(
    chicagoTime.find((p) => p.type === "hour")!.value
  );
  const chicagoMin = Number(
    chicagoTime.find((p) => p.type === "minute")!.value
  );

  const offsetMs =
    (chicagoHour * 60 + chicagoMin - (hour * 60 + minute)) * 60 * 1000;
  return new Date(tempUtc - offsetMs);
}

/**
 * Get the day-of-week (0=Sun … 6=Sat) for a date in America/Chicago.
 */
function getChicagoDayOfWeek(date: Date): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
  }).format(date);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[formatted] ?? 0;
}

/**
 * Advance a date by N calendar days (preserving time-of-day in Chicago).
 */
function addDays(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const d = new Date(year, month - 1, day + days);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

interface ParsedMeeting {
  label?: string;
  startTime: Date;
  endTime: Date;
}

function parseMeetings(input: string): ParsedMeeting[] | null {
  const entries = input.split(",").map((e) => e.trim());
  const meetings: ParsedMeeting[] = [];
  const now = new Date();

  for (const entry of entries) {
    if (!entry) continue;
    const parts = entry.split(/\s+/);
    if (parts.length < 2) return null;

    const [timeStr, durationStr, ...labelWords] = parts;

    // Parse time: 12pm, 3:30pm, etc.
    const timeMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);
    if (!timeMatch) return null;

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || "0");
    const meridiem = timeMatch[3].toLowerCase();

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    // Parse duration: 30m, 60m, etc.
    const durMatch = durationStr.match(/^(\d+)m$/i);
    if (!durMatch) return null;
    const durationMin = Number(durMatch[1]);

    // Start with today in Chicago; if the meeting has already ended, advance
    // to the next business day (skip weekends).
    let { year, month, day } = getChicagoToday();
    let startTime = buildChicagoDate(year, month, day, hour, minute);
    let endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

    if (endTime <= now) {
      // Meeting already passed today — advance to next business day
      let daysToAdd = 1;
      const todayDow = getChicagoDayOfWeek(now);
      if (todayDow === 5) daysToAdd = 3; // Friday → Monday
      else if (todayDow === 6) daysToAdd = 2; // Saturday → Monday

      ({ year, month, day } = addDays(year, month, day, daysToAdd));
      startTime = buildChicagoDate(year, month, day, hour, minute);
      endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
    }

    const label = labelWords.join(" ") || undefined;
    meetings.push({ label, startTime, endTime });
  }

  return meetings;
}

function hydrateMeeting(raw: Record<string, unknown>): Meeting {
  return {
    id: raw.id as string,
    label: (raw.label as string) ?? undefined,
    startTime: new Date(raw.startTime as string),
    endTime: new Date(raw.endTime as string),
  };
}

/**
 * Parse a deadline string like "In 3 hours", "By 3pm", "in 3 h", "in 3 m".
 * Returns a Date or null if input is empty/unparseable.
 */
function parseDeadline(input: string): Date | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // "in X hours/h/minutes/m"
  const relativeMatch = trimmed.match(
    /^in\s+(\d+)\s*(hours?|h|minutes?|mins?|m)$/
  );
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unit = relativeMatch[2];
    const ms =
      unit.startsWith("h") ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
    return new Date(Date.now() + ms);
  }

  // "by 3pm", "by 3:30 pm", "by 3 pm"
  const byMatch = trimmed.match(
    /^by\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/
  );
  if (byMatch) {
    let hour = Number(byMatch[1]);
    const minute = Number(byMatch[2] || "0");
    const meridiem = byMatch[3];

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;

    const { year, month, day } = getChicagoToday();
    let deadline = buildChicagoDate(year, month, day, hour, minute);

    // If the time has already passed today, push to tomorrow
    if (deadline.getTime() <= Date.now()) {
      const tomorrow = addDays(year, month, day, 1);
      deadline = buildChicagoDate(
        tomorrow.year,
        tomorrow.month,
        tomorrow.day,
        hour,
        minute
      );
    }

    return deadline;
  }

  return null;
}

export function SlashCommandProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const { notify } = useNotification();

  // Load initial data from the server
  useEffect(() => {
    fetch("/api/todos")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTodos(data));
    fetch("/api/meetings")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Record<string, unknown>[]) =>
        setMeetings(data.map(hydrateMeeting))
      );
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProjects(data));
  }, []);

  const addTodo = useCallback(
    async (text: string, deadline?: Date, queen?: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const body: Record<string, unknown> = { text: trimmed };
      if (queen) {
        body.queen = true;
        body.priority = 1; // queen tasks are p1
      }
      if (deadline) {
        body.deadline = deadline.toISOString();
        body.priority = 0; // deadline tasks are automatically p0
      }

      try {
        const res = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        const todo = await res.json();
        setTodos((prev) => [...prev, todo]);
      } catch {
        notify("Failed to add todo");
      }
    },
    [notify]
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return;

      const newDone = !todo.done;
      // Optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: newDone } : t))
      );

      try {
        const res = await fetch(`/api/todos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: newDone }),
        });
        if (!res.ok) throw new Error();
      } catch {
        // Revert on failure
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, done: !newDone } : t))
        );
        notify("Failed to update todo");
      }
    },
    [todos, notify]
  );

  const addMeetings = useCallback(
    async (args: string) => {
      const parsed = parseMeetings(args);
      if (!parsed) {
        notify("Usage: /meetings 12pm 30m, 3:30pm 60m Label");
        return;
      }
      if (parsed.length === 0) return;

      try {
        const res = await fetch("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meetings: parsed.map((m) => ({
              label: m.label ?? null,
              startTime: m.startTime.toISOString(),
              endTime: m.endTime.toISOString(),
            })),
          }),
        });
        if (!res.ok) throw new Error();
        const created: Record<string, unknown>[] = await res.json();
        setMeetings((prev) =>
          [...prev, ...created.map(hydrateMeeting)].sort(
            (a, b) => a.startTime.getTime() - b.startTime.getTime()
          )
        );
      } catch {
        notify("Failed to add meetings");
      }
    },
    [notify]
  );

  const removeMeeting = useCallback(
    async (id: string) => {
      setMeetings((prev) => prev.filter((m) => m.id !== id));

      try {
        const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
      } catch {
        // Meeting already removed from UI; no need to re-add an ended meeting
      }
    },
    []
  );

  const reorderProjects = useCallback(
    (fromIndex: number, toIndex: number) => {
      setProjects((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);

        // Persist new order in the background
        const orderedIds = updated.map((p) => p.id);
        fetch("/api/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds }),
        }).catch(() => notify("Failed to save project order"));

        return updated;
      });
    },
    [notify]
  );

  const addProject = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error();
        const project = await res.json();
        setProjects((prev) => [...prev, project]);
      } catch {
        notify("Failed to add project");
      }
    },
    [notify]
  );

  const clearCommand = useCallback(
    async (args: string) => {
      const target = args.trim().toLowerCase();

      try {
        if (target === "meetings") {
          setMeetings([]);
          const res = await fetch("/api/meetings/bulk", { method: "DELETE" });
          if (!res.ok) throw new Error();
        } else if (target === "todos") {
          setTodos([]);
          const res = await fetch("/api/todos/bulk", { method: "DELETE" });
          if (!res.ok) throw new Error();
        } else if (target === "completed") {
          setTodos((prev) =>
            prev.map((t) => (t.done ? { ...t, deleted: true } : t))
          );
          const res = await fetch("/api/todos/bulk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "clear-completed" }),
          });
          if (!res.ok) throw new Error();
        } else {
          notify("Usage: /clear meetings, todos, or completed");
        }
      } catch {
        notify("Failed to clear");
      }
    },
    [notify]
  );

  const setPriority = useCallback(
    async (args: string, priority: number) => {
      const nums = args
        .split(/[\s,]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (nums.length === 0) {
        notify(`Usage: /p${priority} 1, 2, 5`);
        return;
      }

      const activeTodos = todos.filter((t) => !t.deleted);
      const targets: TodoItem[] = [];
      for (const num of nums) {
        const todo = activeTodos[num - 1];
        if (!todo) {
          notify(`Task #${num} does not exist`);
          return;
        }
        targets.push(todo);
      }

      // Optimistic update
      setTodos((prev) =>
        prev.map((t) =>
          targets.some((tgt) => tgt.id === t.id)
            ? { ...t, priority }
            : t
        )
      );

      try {
        await Promise.all(
          targets.map((t) =>
            fetch(`/api/todos/${t.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ priority }),
            }).then((res) => {
              if (!res.ok) throw new Error();
            })
          )
        );
      } catch {
        // Revert on failure
        setTodos((prev) =>
          prev.map((t) => {
            const original = targets.find((tgt) => tgt.id === t.id);
            return original ? { ...t, priority: original.priority } : t;
          })
        );
        notify("Failed to update priority");
      }
    },
    [todos, notify]
  );

  const setBlocked = useCallback(
    async (args: string, blocked: boolean) => {
      const nums = args
        .split(/[\s,]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (nums.length === 0) {
        notify(`Usage: /${blocked ? "blocked" : "unblocked"} 1, 2, 5`);
        return;
      }

      const eligible = todos.filter((t) => !t.deleted && t.blocked !== blocked);
      const targets: TodoItem[] = [];
      for (const num of nums) {
        const todo = eligible[num - 1];
        if (!todo) {
          notify(`Task #${num} does not exist`);
          return;
        }
        targets.push(todo);
      }

      // Optimistic update
      setTodos((prev) =>
        prev.map((t) =>
          targets.some((tgt) => tgt.id === t.id)
            ? { ...t, blocked }
            : t
        )
      );

      try {
        await Promise.all(
          targets.map((t) =>
            fetch(`/api/todos/${t.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ blocked }),
            }).then((res) => {
              if (!res.ok) throw new Error();
            })
          )
        );
      } catch {
        // Revert on failure
        setTodos((prev) =>
          prev.map((t) => {
            const original = targets.find((tgt) => tgt.id === t.id);
            return original ? { ...t, blocked: original.blocked } : t;
          })
        );
        notify("Failed to update blocked status");
      }
    },
    [todos, notify]
  );

  const commands: SlashCommand[] = [
    {
      name: "todo",
      description: "Add an item to the todo list",
      argPlaceholder: "What needs to be done?",
      execute: (args) => addTodo(args),
      interactivePrompts: [
        { key: "text", question: "What do you want to do?", required: true },
        {
          key: "deadline",
          question: "When do you want to do it?",
          required: false,
        },
      ],
      executeInteractive: (answers) => {
        const deadline = parseDeadline(answers.deadline);
        addTodo(answers.text, deadline ?? undefined);
      },
    },
    {
      name: "queen",
      description: "Add a high-priority queen task",
      argPlaceholder: "What needs to be done?",
      execute: (args) => addTodo(args, undefined, true),
      interactivePrompts: [
        { key: "text", question: "What do you want to do?", required: true },
        {
          key: "deadline",
          question: "When do you want to do it?",
          required: false,
        },
      ],
      executeInteractive: (answers) => {
        const deadline = parseDeadline(answers.deadline);
        addTodo(answers.text, deadline ?? undefined, true);
      },
    },
    {
      name: "meetings",
      description: "Add today's meetings",
      argPlaceholder: "12pm 30m Standup, 3:30pm 60m Design Review",
      execute: addMeetings,
    },
    {
      name: "clear",
      description: "Clear meetings, todos, or completed",
      argPlaceholder: "meetings | todos | completed",
      execute: clearCommand,
    },
    {
      name: "p0",
      description: "Mark tasks as highest priority",
      argPlaceholder: "1, 2, 5",
      execute: (args) => setPriority(args, 0),
      showTaskReference: true,
    },
    {
      name: "p1",
      description: "Revert tasks to normal priority",
      argPlaceholder: "1, 2, 5",
      execute: (args) => setPriority(args, 1),
      showTaskReference: true,
    },
    {
      name: "blocked",
      description: "Mark tasks as blocked",
      argPlaceholder: "1, 2, 5",
      execute: (args) => setBlocked(args, true),
      showTaskReference: true,
      filterTaskReference: (t) => !t.blocked,
    },
    {
      name: "unblocked",
      description: "Mark tasks as unblocked",
      argPlaceholder: "1, 2, 5",
      execute: (args) => setBlocked(args, false),
      showTaskReference: true,
      filterTaskReference: (t) => t.blocked,
    },
    {
      name: "project",
      description: "Add a project",
      argPlaceholder: "Project name",
      execute: (args) => addProject(args),
    },
  ];

  return (
    <SlashCommandContext.Provider
      value={{ todos, toggleTodo, meetings, removeMeeting, projects, reorderProjects, commands }}
    >
      {children}
    </SlashCommandContext.Provider>
  );
}
