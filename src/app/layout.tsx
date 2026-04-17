import type { Metadata } from "next";
import { Inter, Poppins, Roboto_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutContent } from "@/components/layout/layout-content";
import { DatabaseProvider } from "@/components/providers/database-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Synq | Productivity OS",
  description: "Minimal productivity for teams and individuals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} ${manrope.variable} ${robotoMono.variable} antialiased font-sans h-full overflow-hidden bg-background text-foreground`}>
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
