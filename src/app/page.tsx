import { auth, signIn, signOut } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return (
      <main>
        <p>Signed in as {session.user.email}</p>
        <form
          action={async () => {
            "use server";
            await signOut();
          }}
        >
          <button type="submit">Sign out</button>
        </form>
      </main>
    );
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form
        action={async (formData) => {
          "use server";
          await signIn("resend", formData);
        }}
      >
        <input type="email" name="email" placeholder="you@example.com" required />
        <button type="submit">Send magic link</button>
      </form>
    </main>
  );
}
