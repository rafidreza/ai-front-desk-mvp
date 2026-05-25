import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Internal',
  description: 'Internal operations console for Daemon.',
};

export default function InternalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
