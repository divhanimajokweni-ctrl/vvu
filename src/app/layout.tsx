import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Venture Vision Ubuntu — publish a twin, prove the receipt",
  description:
    "One free build, shareable to 25 people for 7 days, exportable to Obsidian under MIT forever. Commercial use pays. Every share is a signed, revocable, WORM-logged event.",
  keywords: [
    "digital twin",
    "WORM chain",
    "Obsidian export",
    "Stitch",
    "Paystack",
    "Puter.js",
    "South Africa",
    "SEARM",
    "Venture Vision Ubuntu",
  ],
  authors: [{ name: "Venture Vision Ubuntu" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Venture Vision Ubuntu",
    description:
      "Publish a twin, prove the receipt. Free build + commercial gate, MIT export, WORM-logged shares.",
    siteName: "Venture Vision Ubuntu",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Venture Vision Ubuntu",
    description:
      "Publish a twin, prove the receipt. Free build + commercial gate, MIT export, WORM-logged shares.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
