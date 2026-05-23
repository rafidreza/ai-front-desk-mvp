import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI Front Desk',
    template: '%s · AI Front Desk',
  },
  description:
    'We answer your Facebook and WhatsApp customer messages with AI, and only send you the tickets that need your decision.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
