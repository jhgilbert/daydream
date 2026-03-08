import type { Metadata } from "next";
import { NotificationProvider } from "@/components/NotificationProvider";
import { SlashCommandProvider } from "@/components/SlashCommandProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daydream",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          <SlashCommandProvider>{children}</SlashCommandProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
