import { Poppins, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500"],
});


export const metadata = {
  title: "Enc Nexus | Sovereign Administrative Dashboard",
  description: "The peak of guild governance and resource management.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${dmSans.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-background text-foreground font-sans min-h-screen antialiased">


        <SessionWrapper>
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}

