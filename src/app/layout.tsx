import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/is-admin";
import AdminBar from "@/components/AdminBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrontoloBike",
  description: "Campionato Sociale BrontoloBike",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = isAdmin(user);

  return (
    <html lang="it" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bb-bg">
        {children}
        {admin && <AdminBar />}
      </body>
    </html>
  );
}
