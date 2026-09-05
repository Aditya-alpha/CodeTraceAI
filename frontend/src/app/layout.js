import './globals.css';
import Providers from '../components/Providers';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'CodeTraceAI — AI-Powered Repository Intelligence & API Testing',
  description:
    'Static AST analysis, Cross-Router prefix resolution, RAG Q&A, and deterministic API flowcharts for Node.js Express repositories.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#080c14] text-slate-100 antialiased flex flex-col selection:bg-sky-500/30 selection:text-sky-200">
        <Providers>
          <Navbar />
          <main className="flex-1 flex flex-col">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
