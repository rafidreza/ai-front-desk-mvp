import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Front Desk Internal',
  description: 'Internal operations console for AI Front Desk.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
