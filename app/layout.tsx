import './globals.css';

export const metadata = {
  title: 'Dividir Contas - Finanças de Casal',
  description: 'Organize suas finanças conjuntas com inteligência',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

