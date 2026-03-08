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

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return ctx;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setMessage(msg);
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
