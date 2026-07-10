import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EC Tower Live Monitor',
  description: 'Real-time eddy covariance tower monitoring dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
