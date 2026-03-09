"use client";

import { useEffect, useState } from "react";
import { useSlashCommands } from "./SlashCommandProvider";
import styles from "./TimeUntilMeeting.module.css";

function formatCountdown(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes < 1) return "< 1 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}

export function TimeUntilMeeting() {
  const { meetings, eodTime } = useSlashCommands();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Find the next meeting that hasn't started yet
  const nextMeeting = meetings
    .filter((m) => m.startTime.getTime() > now.getTime())
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

  const eodIsActive = eodTime && eodTime.getTime() > now.getTime();
  const eodIsBeforeNextMeeting =
    eodIsActive && (!nextMeeting || eodTime.getTime() <= nextMeeting.startTime.getTime());

  // Show EOD countdown when it's before the next meeting;
  // once EOD passes, show the next meeting countdown
  const targetTime = eodIsBeforeNextMeeting
    ? eodTime.getTime()
    : nextMeeting
      ? nextMeeting.startTime.getTime()
      : null;

  if (!targetTime) return null;

  const msUntil = targetTime - now.getTime();
  const isUrgent = msUntil <= 10 * 60_000;

  return (
    <div className={`${styles.container} ${isUrgent ? styles.urgent : ""}`}>
      <span className={`${styles.time} ${isUrgent ? styles.timeUrgent : ""}`}>
        {formatCountdown(msUntil)}
      </span>
    </div>
  );
}
