import './globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import Navigation from '@/components/Navigation'
import SubscriptionGate from '@/components/SubscriptionGate'
import SubscriptionWarning from '@/components/SubscriptionWarning'
import HelpSystemWrapper from '@/components/HelpSystemWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'CCTV Inspection Reporting',
  description: 'Professional CCTV Inspection Platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <SubscriptionGate>
            <HelpSystemWrapper>
              <Navigation />
              <main className="container mx-auto px-4 py-8">
                {children}
              </main>
              <SubscriptionWarning />
            </HelpSystemWrapper>
          </SubscriptionGate>
        </AuthProvider>
      </body>
    </html>
  )
}