// src/app/layout.tsx
import './globals.css'; 
import ClientHeader from './ClientHeader'; // ✅ 새 클라이언트 헤더 임포트

export const metadata = { title: 'RAG Work Assistant' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body> 
        {/* ✅ <ClientHeader />가 <main>보다 먼저 와야 합니다. */}
        <ClientHeader /> 
        
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}