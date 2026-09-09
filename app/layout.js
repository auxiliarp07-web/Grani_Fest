import './globals.css';

export const metadata = {
  title: 'Grani Fest',
  description: 'Secure community voting platform for brands and users.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
