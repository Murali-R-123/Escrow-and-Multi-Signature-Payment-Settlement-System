import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'Escrow Engine – Multi-Signature Payment Settlement',
  description: 'DBMS Level 3 project: MySQL + MongoDB escrow with m-of-n approvals',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
