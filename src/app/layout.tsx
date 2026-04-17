import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutContent } from "@/components/layout/layout-content";
import { DatabaseProvider } from "@/components/providers/database-provider";

const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-roboto",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

export const metadata: Metadata = {
  title: "Synq | Productivity OS",
  description: "Minimal productivity for teams and individuals",
  icons: {
    icon: "/brand-logo.png",
    apple: "/brand-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body className={`${roboto.variable} ${robotoMono.variable} antialiased font-sans h-full overflow-hidden bg-background text-foreground`}>
        <TooltipProvider>
          <DatabaseProvider>
            <LayoutContent>{children}</LayoutContent>
          </DatabaseProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}

// LayoutContent is now in src/components/layout/layout-content.tsx
