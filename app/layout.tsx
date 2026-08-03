import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FUT DA GALERA',
  description: 'Organize suas peladas, confirme presença e monte times equilibrados com facilidade.',
  openGraph: {
    title: 'FUT DA GALERA',
    description: 'Organize suas peladas, confirme presença e monte times equilibrados com facilidade.',
    url: 'https://futdagalera.vercel.app',
    siteName: 'FUT DA GALERA',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="relative min-h-screen bg-[#090909] text-white antialiased">
        <div className="fixed inset-0 -z-20 bg-[url('/foto3.jpg')] bg-cover bg-center" />
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-black/75 via-black/70 to-black/80" />
        {children}
      </body>
    </html>
  );
}
