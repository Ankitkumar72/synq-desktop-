import type { Metadata } from "next";
import { Inter, Poppins, Roboto_Mono } from "next/font/google";
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
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} ${robotoMono.variable} antialiased font-sans h-full overflow-hidden bg-white text-stone-900`}>
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
