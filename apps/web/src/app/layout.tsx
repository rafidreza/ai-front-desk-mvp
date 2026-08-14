import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Daemion',
    template: '%s · Daemion',
  },
  description:
    'Daemion helps teams run AI-assisted support operations and surface only the customer tickets that need a decision.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <NextIntlClientProvider locale="en" messages={{}}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
