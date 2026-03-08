"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useNotification } from "./NotificationProvider";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Meeting {
  id: string;
  label?: string;
  startTime: Date;
  endTime: Date;
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
  meetings: Meeting[];
  removeMeeting: (id: string) => void;
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

function parseMeetings(input: string): Meeting[] | null {
  const entries = input.split(",").map((e) => e.trim());
  const meetings: Meeting[] = [];
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
    meetings.push({ id: crypto.randomUUID(), label, startTime, endTime });
  }

  return meetings;
}

export function SlashCommandProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const { notify } = useNotification();

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

  const addMeetings = useCallback(
    (args: string) => {
      const parsed = parseMeetings(args);
      if (!parsed) {
        notify("Usage: /meetings 12pm 30m, 3:30pm 60m Label");
        return;
      }
      if (parsed.length === 0) return;
      setMeetings((prev) =>
        [...prev, ...parsed].sort(
          (a, b) => a.startTime.getTime() - b.startTime.getTime()
        )
      );
    },
    [notify]
  );

  const removeMeeting = useCallback((id: string) => {
    setMeetings((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearCommand = useCallback(
    (args: string) => {
      const target = args.trim().toLowerCase();
      if (target === "meetings") {
        setMeetings([]);
      } else if (target === "todos") {
        setTodos([]);
      } else {
        notify("Usage: /clear meetings or /clear todos");
      }
    },
    [notify]
  );

  const commands: SlashCommand[] = [
    {
      name: "todo",
      description: "Add an item to the todo list",
      argPlaceholder: "What needs to be done?",
      execute: addTodo,
    },
    {
      name: "meetings",
      description: "Add today's meetings",
      argPlaceholder: "12pm 30m Standup, 3:30pm 60m Design Review",
      execute: addMeetings,
    },
    {
      name: "clear",
      description: "Clear meetings or todos",
      argPlaceholder: "meetings or todos",
      execute: clearCommand,
    },
  ];

  return (
    <SlashCommandContext.Provider
      value={{ todos, toggleTodo, meetings, removeMeeting, commands }}
    >
      {children}
    </SlashCommandContext.Provider>
  );
}
