import { auth, signIn, signOut } from "@/auth";
import { MeetingList } from "@/components/MeetingList";
import { TestNotificationButton } from "@/components/TestNotificationButton";
import { TodoList } from "@/components/TodoList";
import { CommandBar } from "@/components/CommandBar";
import styles from "./page.module.css";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return (
      <>
        <main className={styles.main}>
          <TodoList />
          <MeetingList />
          <TestNotificationButton className={styles.button} />
        </main>
        <footer className={styles.footer}>
          <span className={styles.footerStatus}>
            Signed in as {session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button type="submit" className={styles.footerLink}>
              Sign out
            </button>
          </form>
        </footer>
        <CommandBar />
      </>
    );
  }

  return (
    <main className={styles.mainCentered}>
      <h1 className={styles.title}>Sign in</h1>
      <form
        action={async (formData) => {
          "use server";
          await signIn("resend", formData);
        }}
        className={styles.form}
      >
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          className={styles.input}
        />
        <button type="submit" className={styles.button}>
          Send magic link
        </button>
      </form>
      <TestNotificationButton className={styles.button} />
    </main>
  );
}
