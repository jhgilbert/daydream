# Plan: `/meetings` and `/clear` Slash Commands

## Overview

Add a `/meetings` slash command that lets the user quickly enter today's meetings as time/duration pairs with optional labels. Meetings appear in a new **Meetings** section below the Todos section, with live countdowns, a breathing animation when 10 minutes away, an IN PROGRESS badge during the meeting, and automatic removal once the meeting ends.

Also add a `/clear` command that can clear meetings or todos: `/clear meetings` or `/clear todos`.

---

## User interface

### Input format

```
/meetings 12pm 30m, 3:30pm 60m
/meetings 12pm 30m Standup, 3:30pm 60m Design Review
```

- Comma-separated entries; each entry is `<start-time> <duration> [optional label]`.
- Times use 12-hour format (`12pm`, `3:30pm`, `1am`, etc.).
- Duration is always in minutes (`30m`, `60m`, `90m`).
- Everything after the duration is treated as an **optional label** (e.g., "Standup", "Design Review").
- All times are interpreted as **US Central time** (America/Chicago), which automatically respects CDT/CST via the IANA timezone database.
- Meetings are always for **today** — no date parameter needed.
- Running the command again **appends** to the existing list (does not replace).

### `/clear` command

```
/clear meetings    — removes all meetings
/clear todos       — removes all todos
```

- Registered as a separate slash command with argument placeholder "meetings or todos".
- If the argument doesn't match `meetings` or `todos`, show a usage hint via notification.

### Meetings section

- Appears **below** the Todos section on the main page.
- Heading: **Meetings** (same style as the Todos heading).
- Sorted chronologically, soonest first.
- Each meeting row shows:

```
┌─────────────────────────────────────────────────┐
│  12:00 PM – 12:30 PM  Standup           47 min │
│  3:30 PM – 4:30 PM  Design Review  3 hr 12 min │
└─────────────────────────────────────────────────┘
```

- If no label was provided, the row simply shows the time range and countdown.
- **Time range** on the left (formatted in 12-hour with AM/PM).
- **Label** (if any) after the time range.
- **Countdown** on the right, showing time remaining until start. Rules:
  - Hours and minutes only — no seconds (avoids distracting countdowns).
  - Under 1 hour: "47 min"
  - 1 hour or more: "1 hr 12 min" / "3 hr"
  - Under 1 minute: "Less than a minute"
- When the meeting is **in progress** (current time is between start and end):
  - Replace the countdown with an **IN PROGRESS** badge (square with slightly rounded corners, uses `--color-success` / `--color-success-foreground` tokens).
  - Stop the breathing animation (if it was active).
- When the meeting **has ended** (current time is past end time):
  - Remove the meeting from the list entirely.
- If all meetings have ended, hide the Meetings section.

### Breathing animation (urgent meeting alert)

Instead of firing notifications, the meeting row itself takes on the same **breathing animation** used by the notification banner (color shifts between `#b01a56` and `#ff69b4` over 2 seconds):

- **Starts** when the meeting is **10 minutes or less** away.
- **Continues uninterruptibly** — the user cannot dismiss or stop it.
- **Stops** when the meeting's start time arrives (transitions to IN PROGRESS badge).
- The breathing applies to the meeting row's background color, making it visually urgent.
- Text within a breathing row should be white for contrast (matching the notification banner style).

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/components/MeetingList.tsx` | Client component — renders the Meetings section, manages countdown interval, applies breathing class |
| `src/components/MeetingList.module.css` | Styles for the Meetings section, including the breathing animation |

### Modified files

| File | Change |
|------|--------|
| `src/components/SlashCommandProvider.tsx` | Add `meetings` state array, `clearMeetings` and `clearTodos` functions, `/meetings` command (parses input, appends meetings), and `/clear` command |
| `src/app/page.tsx` | Render `<MeetingList />` below `<TodoList />` |

### No new files needed for

- **Timezone handling** — use the built-in `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'` and `Date` objects. No external library needed.
- **Breathing animation** — reuse the same keyframes concept from `NotificationBanner.module.css`, defined locally in `MeetingList.module.css`.

---

## Data model

```typescript
interface Meeting {
  id: string;          // crypto.randomUUID()
  label?: string;      // Optional user-provided label
  startTime: Date;     // Absolute start time (today in America/Chicago)
  endTime: Date;       // startTime + duration
}
```

State lives in `SlashCommandProvider` alongside `todos`, exposed via context as `meetings` and consumed by `MeetingList`.

No notification tracking flags needed — the breathing animation is purely time-based (computed on each render tick from `startTime - now <= 10 min`).

---

## Parsing logic

Located in `SlashCommandProvider.tsx` (or a small helper within it):

1. Split input on `,` to get individual entries.
2. For each entry, trim and split on whitespace → `[timeStr, durationStr, ...labelWords]`.
3. Parse `timeStr`:
   - Regex: `/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i`
   - Extract hour, optional minutes, and meridiem.
   - Convert to 24-hour, then create a `Date` for today in America/Chicago.
4. Parse `durationStr`:
   - Regex: `/^(\d+)m$/i`
   - Extract minutes as a number.
5. Join remaining words as `label` (may be empty).
6. Compute `endTime = startTime + duration`.
7. If `endTime` is already past, skip this meeting (already over).
8. Create a `Meeting` object.

### Constructing a Date in America/Chicago

Since the user intends Central time, we need to convert properly:

1. Get today's date string in America/Chicago using `Intl.DateTimeFormat`.
2. Combine with the parsed hour/minute to build the target local time.
3. Use a round-trip approach: format today's date in Chicago, parse it, set the hour/minute, then compute the UTC offset to build a correct `Date` object.

This avoids any external library and correctly handles DST transitions.

---

## Countdown & lifecycle

`MeetingList` runs a `setInterval` every **30 seconds** (sufficient for minute-level precision without unnecessary renders):

1. Compute `now` on each tick (force a re-render via state update).
2. For each meeting:
   - If `now >= endTime` → filter it out of state (meeting over).
   - If `now >= startTime` → show IN PROGRESS badge, no breathing.
   - If `startTime - now <= 10 min` → apply breathing animation CSS class to the row.
   - Otherwise → compute and display time remaining.

The interval is cleaned up on unmount via `useEffect` return.

---

## Styling approach

### MeetingList.module.css

Follows the same patterns as `TodoList.module.css`:

- `.section` — same max-width (28rem), centered.
- `.heading` — reuse same font size/weight tokens as TodoList heading.
- `.list` — `<ul>` with gap, no bullets.
- `.item` — flex row, space-between, padding, hover background, `border-radius` for the breathing state.
- `.timeRange` — left side, `--text-sm`, `--font-weight-medium`.
- `.label` — after time range, `--text-sm`, slightly muted.
- `.countdown` — right side, `--text-sm`, `--color-muted-foreground`.
- `.badge` — square shape with slightly rounded corners (`--radius-sm`), small text, success color tokens.
- `.breathing` — applies the breathing keyframe animation to the row background. Text becomes white. Mirrors the `@keyframes breathe` from `NotificationBanner.module.css`.

All values reference `var(--…)` design tokens from `theme.css`.

---

## Edge cases

| Scenario | Behavior |
|----------|----------|
| User enters a time already past (meeting ended) | Meeting is silently skipped (already ended) |
| User enters a meeting currently in progress | Added with IN PROGRESS badge; no breathing |
| User enters a meeting less than 10 min away | Added with breathing animation already active |
| User runs `/meetings` multiple times | Meetings append to the list; duplicates are the user's responsibility |
| Invalid input format | Show a notification with a usage hint: *"Usage: /meetings 12pm 30m, 3:30pm 60m Label"* |
| Midnight rollover (e.g., `11:30pm 90m` ending at 1:00 AM) | Works naturally since we compute `endTime = startTime + duration` on absolute `Date` objects |
| DST transition day | Handled by the Intl/timezone-aware date construction — no special code needed |
| `/clear meetings` with no meetings | No-op, section already hidden |
| `/clear todos` with no todos | No-op, section already hidden |
| `/clear` with no or invalid argument | Show notification: *"Usage: /clear meetings or /clear todos"* |

---

## Accessibility

- Meeting list uses semantic `<ul>` / `<li>`.
- IN PROGRESS badge includes `role="status"` for screen readers.
- Breathing animation is purely visual; screen readers see the countdown text which still updates.
- Countdown text updates are not live-announced (would be noisy); the visual breathing animation handles urgency for sighted users.

---

## Implementation order

1. Add `Meeting` interface, `meetings` state, `clearMeetings`, and `clearTodos` to `SlashCommandProvider`.
2. Add parsing logic and `/meetings` command registration.
3. Add `/clear` command registration.
4. Build `MeetingList` component with static rendering (no countdown yet).
5. Add countdown interval logic and meeting expiration.
6. Add breathing animation for meetings within 10 minutes.
7. Add `MeetingList.module.css` styles (including breathing keyframes).
8. Render `<MeetingList />` in `page.tsx` below `<TodoList />`.
9. Test edge cases (past meetings, in-progress, breathing threshold, DST, invalid input, midnight rollover, `/clear` commands).
