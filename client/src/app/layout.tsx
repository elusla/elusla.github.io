import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Telegram Clone',
  description: 'Telegram Web Clone MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-tg-bg text-tg-text h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
