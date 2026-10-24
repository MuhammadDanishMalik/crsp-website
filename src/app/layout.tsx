import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Naskh_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Providers } from "./providers";
import { ServiceWorker } from "@/components/service-worker";
import { UpdateBanner } from "@/components/update-banner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const urdu = Noto_Naskh_Arabic({ variable: "--font-urdu", subsets: ["arabic"], weight: ["400", "600", "700"] });

/** Server functions may run up to 60 s (taking an order writes many rows to the remote database; the default 10 s cut it off). */
export const maxDuration = 60;

export const metadata: Metadata = { title: "CRSP POS", description: "CRSP point of sale & restaurant management", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    // Dark is the default (cashier screen); admin layout switches the class client-side.
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${urdu.variable} dark`} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}><Providers>{children}</Providers></NextIntlClientProvider>
        <ServiceWorker />
        <UpdateBanner />
      </body>
    </html>
  );
}
