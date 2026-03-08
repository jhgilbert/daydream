"use client";

import { useNotification } from "./NotificationProvider";

export function TestNotificationButton({ className }: { className?: string }) {
  const { notify } = useNotification();

  return (
    <button
      type="button"
      className={className}
      onClick={() => notify("This is a test notification — acknowledge it!")}
    >
      Send test notification
    </button>
  );
}
