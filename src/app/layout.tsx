import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { ToastProvider } from "@/components/ui/feedback";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VIAC Reports",
    template: "%s · VIAC Reports",
  },
  description:
    "Community outreach session tracking and standardised reporting for Vision in Action Cameroon.",
  openGraph: {
    title: "VIAC Reports",
    description:
      "Community outreach session tracking and standardised reporting for Vision in Action Cameroon.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
