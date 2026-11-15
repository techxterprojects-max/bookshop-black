/* eslint-disable @next/next/no-page-custom-font -- The root App Router layout loads these fonts site-wide. */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LXE Creative | Colorful Coloring Books by Angelica White",
  description: "Explore coloring and activity books for kids and adults by Angelica White.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  </head><body>{children}</body></html>;
}
