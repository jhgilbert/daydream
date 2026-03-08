"use client";

import { useEffect, useState } from "react";
import { useSlashCommands } from "./SlashCommandProvider";
import styles from "./MeetingList.module.css";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 1) return "Less than a minute";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function MeetingList() {
  const { meetings, removeMeeting } = useSlashCommands();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Remove ended meetings
  useEffect(() => {
    for (const meeting of meetings) {
      if (now >= meeting.endTime) {
        removeMeeting(meeting.id);
      }
    }
  }, [now, meetings, removeMeeting]);

  const activeMeetings = meetings.filter((m) => now < m.endTime);
  if (activeMeetings.length === 0) return null;

  return (
    <section className={styles.container}>
      <h2 className={styles.heading}>Meetings</h2>
      <ul className={styles.list}>
        {activeMeetings.map((meeting) => {
          const msUntilStart = meeting.startTime.getTime() - now.getTime();
          const isInProgress = msUntilStart <= 0;
          const isBreathing = !isInProgress && msUntilStart <= 10 * 60_000;

          const itemClasses = [
            styles.item,
            isBreathing ? styles.breathing : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={meeting.id} className={itemClasses}>
              <div className={styles.left}>
                <span className={isBreathing ? styles.timeRangeUrgent : styles.timeRange}>
                  {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
                </span>
                {meeting.label && (
                  <span className={isBreathing ? styles.labelUrgent : styles.label}>
                    {meeting.label}
                  </span>
                )}
              </div>
              <div className={styles.right}>
                {isInProgress ? (
                  <span className={styles.badge} role="status">
                    IN PROGRESS
                  </span>
                ) : (
                  <span className={isBreathing ? styles.countdownUrgent : styles.countdown}>
                    {formatCountdown(msUntilStart)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
