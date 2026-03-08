import { auth, signIn, signOut } from "@/auth";
import styles from "./page.module.css";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return (
      <main className={styles.main}>
        <p className={styles.status}>Signed in as {session.user.email}</p>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button type="submit" className={styles.button}>
            Sign out
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.main}>
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
    </main>
  );
}
