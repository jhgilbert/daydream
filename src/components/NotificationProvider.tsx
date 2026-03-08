"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import styles from "./NotificationBanner.module.css";

interface NotificationContextValue {
  notify: (message: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}

export function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Three-tone rising chime
    const frequencies = [523, 659, 784];
    const noteDuration = 0.25;
    const fadeOut = 0.4;

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * noteDuration;
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.setValueAtTime(0.1, start + noteDuration * 0.8);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + noteDuration + fadeOut,
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + noteDuration + fadeOut);
    });
  } catch {
    // AudioContext may not be available in all environments
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const notify = useCallback((msg: string) => {
    setMessage(msg);
    playChime();
  }, []);

  const dismiss = useCallback(() => {
    setMessage(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {message && (
        <div className={styles.banner} role="alert">
          <span className={styles.message}>{message}</span>
          <button className={styles.ackButton} onClick={dismiss}>
            Ack
          </button>
        </div>
      )}
      {children}
    </NotificationContext.Provider>
  );
}
