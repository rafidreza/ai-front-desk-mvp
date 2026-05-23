import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Internal',
  description: 'Internal operations console for AI Front Desk.',
};

export default function InternalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
