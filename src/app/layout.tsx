import type { Metadata } from "next";
import { Roboto, Roboto_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutContent } from "@/components/layout/layout-content";
import { ServiceWorkerRegister } from "@/components/providers/service-worker-register";
import { DatabaseProvider } from "@/components/providers/database-provider";
import brandLogo from "../../assets/images/brand-logo.png";

const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "optional",
});

export const metadata: Metadata = {
  title: "Synq | Productivity OS",
  description: "Minimal productivity for teams and individuals",
  icons: {
    icon: brandLogo.src,
    apple: brandLogo.src,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark" suppressHydrationWarning>
      <body className={`${roboto.variable} ${robotoMono.variable} ${playfair.variable} antialiased font-sans h-full bg-background text-foreground`}>
        <TooltipProvider>
          <ServiceWorkerRegister />
          <DatabaseProvider>
            <LayoutContent>{children}</LayoutContent>
          </DatabaseProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}

// LayoutContent is now in src/components/layout/layout-content.tsx
