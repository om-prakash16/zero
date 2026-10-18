import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CROSSWIRE — Real-Time Multilingual Arguments',
  description:
    'Have a natural, emotionally expressive argument across any language barrier with real-time voice translation.',
  keywords: ['translation', 'multilingual', 'voice', 'real-time', 'argument', 'communication'],
  openGraph: {
    title: 'CROSSWIRE — Real-Time Multilingual Arguments',
    description: "You don't need the same language to have the same argument.",
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-[#f8fafc] text-slate-900 dark:bg-[#09090b] dark:text-zinc-100 transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
