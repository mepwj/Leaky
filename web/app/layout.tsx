import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Leaky Web',
  description: 'Leaky household ledger web app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
