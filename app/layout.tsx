import './globals.css';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'MetaSelf',
  description: 'Outlook Integration with Knowledge Base',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
