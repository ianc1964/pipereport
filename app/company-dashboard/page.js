'use client'

import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import { 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp,
  Settings,
  AlertCircle,
  Home,
  Archive,
  RefreshCw,
  Palette,
  MessageCircle
} from 'lucide-react'
import HelpIcon from '@/components/help/HelpIcon'

export default function CompanyDashboard() {
  const { profile, company, creditsBalance } = useAuth()

  return (
    <ProtectedRoute allowedRoles={['company_admin', 'super_admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">Company Dashboard</h1>
                  <HelpIcon
                    title="Company Dashboard"
                    content="Central hub for managing your company's account and settings."
                    bullets={[
                      "Only company admins can access this area",
                      "Manage users, credits, and company settings",
                      "View usage analytics and reports",
                      "Configure branding for professional reports",
                      "Download backups of your inspection data"
                    ]}
                    modal={true}
                  />
                </div>
                <p className="text-gray-600">{company?.name || 'Your Company'}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="text-sm text-gray-600">Current Balance</div>
                <HelpIcon
                  title="Credit System"
                  content="Credits are consumed for various operations."
                  bullets={[
                    "Video upload: Varying credits per video, based on size",
                    "Frame capture: 1 credit per image",
                    "AI analysis: 5 credits per analysis",
                    "Credits never expire",
                    "Purchase more in Account → Subscription"
                  ]}
                  size="sm"
                />
              </div>
              <div className="text-2xl font-bold text-gray-900">{creditsBalance} Credits</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="relative">
            <Link href="/company-dashboard/users" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <Users className="h-8 w-8 text-blue-500 mb-3" />
                <h3 className="font-semibold text-gray-900">Manage Users</h3>
                <p className="text-sm text-gray-600 mt-1">Add and manage team members</p>
              </div>
            </Link>
            <div className="absolute top-2 right-2">
              <HelpIcon
                title="User Management"
                content="Control who has access to your company's projects."
                bullets={[
                  "Invite team members via email",
                  "Assign roles (Admin or User)",
                  "Company admins can manage all settings",
                  "Regular users can create and edit projects",
                  "Remove access when team members leave"
                ]}
                size="sm"
              />
            </div>
          </div>

          <div className="relative">
            <Link href="/company-dashboard/support" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <MessageCircle className="h-8 w-8 text-orange-500 mb-3" />
                <h3 className="font-semibold text-gray-900">Support Tickets</h3>
                <p className="text-sm text-gray-600 mt-1">Get help from our support team</p>
              </div>
            </Link>
            <div className="absolute top-2 right-2">
              <HelpIcon
                title="Support System"
                content="Direct communication with our support team."
                bullets={[
                  "Create support tickets for any issues",
                  "Real-time chat with support agents",
                  "Track ticket status and history",
                  "Attach files and screenshots",
                  "Get priority support for urgent issues"
                ]}
                size="sm"
              />
            </div>
          </div>

          <div className="relative">
            <Link href="/company-dashboard/credits" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <CreditCard className="h-8 w-8 text-green-500 mb-3" />
                <h3 className="font-semibold text-gray-900">Credit History</h3>
                <p className="text-sm text-gray-600 mt-1">View usage and purchases</p>
              </div>
            </Link>
            <div className="absolute top-2 right-2">
              <HelpIcon
                title="Credit History"
                content="Track all credit transactions and usage."
                bullets={[
                  "See all credit purchases",
                  "Track usage by operation type",
                  "View who consumed credits",
                  "Export transaction history",
                  "Monitor spending patterns"
                ]}
                size="sm"
              />
            </div>
          </div>

          <div className="relative">
            <Link href="/company-dashboard/usage" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <TrendingUp className="h-8 w-8 text-purple-500 mb-3" />
                <h3 className="font-semibold text-gray-900">Usage Stats</h3>
                <p className="text-sm text-gray-600 mt-1">View detailed analytics</p>
              </div>
            </Link>
            <div className="absolute top-2 right-2">
              <HelpIcon
                title="Usage Analytics"
                content="Understand how your team uses the platform."
                bullets={[
                  "Daily, weekly, monthly usage trends",
                  "Breakdown by operation type",
                  "Identify heavy usage periods",
                  "Track project activity",
                  "Optimize credit purchases"
                ]}
                size="sm"
              />
            </div>
          </div>

          <div className="relative">
            <Link href="/company-dashboard/branding" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <Palette className="h-8 w-8 text-pink-500 mb-3" />
                <h3 className="font-semibold text-gray-900">Report Branding</h3>
                <p className="text-sm text-gray-600 mt-1">Manage branding profiles</p>
              </div>
            </Link>
            <div className="absolute top-2 right-2">
              <HelpIcon
                title="Branding Profiles"
                content="Customise reports with your company branding."
                bullets={[
                  "Add company logo to reports",
                  "Set custom color schemes",
                  "Include contact information",
                  "Create multiple profiles for different clients",
                  "Set a default profile for all reports"
                ]}
                size="sm"
              />
            </div>
          </div>

          <div className="relative">
            <Link href="/company-dashboard/backup" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <Archive className="h-8 w-8 text-indigo-500 mb-3" />
                <h3 className="font-semibold text-gray-900">Data Backup</h3>
                <p className="text-sm text-gray-600 mt-1">Download project backups</p>
              </div>
            </Link>
            <div className="absolute top-2 right-2">
              <HelpIcon
                title="Data Backup"
                content="Export and archive your inspection data."
                bullets={[
                  "Download complete project data",
                  "Includes all observations and media",
                  "JSON format for data portability",
                  "Backup before major changes",
                  "Can restore from backup files"
                ]}
                size="sm"
              />
            </div>
          </div>

          <div className="relative">
            <Link href="/company-dashboard/settings" className="block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <Settings className="h-8 w-8 text-gray-500 mb-3" />
                <h3 className="font-semibold text-gray-900">Company Settings</h3>
                <p className="text-sm text-gray-600 mt-1">Update company details</p>
              </div>
            </Link>
            <div className="absolute top-2 right-2">
              <HelpIcon
                title="Company Settings"
                content="Manage your company profile and preferences."
                bullets={[
                  "Update company logo, name and contact info",
                  "Configure notification preferences",
                  "Subscription Info"
                ]}
                size="sm"
              />
            </div>
          </div>
        </div>

        {/* Credit Warning */}
        {creditsBalance < 20 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-yellow-800">Low Credit Balance</h3>
                  <HelpIcon
                    title="Low Credits Warning"
                    content="Your credit balance is running low."
                    bullets={[
                      "Videos need 10 credits to upload",
                      "Consider purchasing credits before starting new inspections",
                      "Credits are shared across all users in your company",
                      "Purchase credits or upgrade subscription to continue"
                    ]}
                    size="sm"
                  />
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  You have {creditsBalance} credits remaining. Consider purchasing more credits to avoid interruption.
                </p>
                <Link 
                  href="/account/subscription?tab=credits" 
                  className="inline-flex items-center mt-2 text-sm font-medium text-yellow-800 hover:text-yellow-900"
                >
                  Purchase Credits →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick Links</h2>
            <HelpIcon
              title="Quick Navigation"
              content="Shortcuts to commonly used features."
              bullets={[
                "Projects: Return to main project list",
                "Restore: Recover data from backup files",
                "These links help you navigate quickly",
                "Available from any dashboard page"
              ]}
              size="sm"
            />
          </div>
          <div className="space-y-3">
            <Link 
              href="/" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <Home className="w-4 h-4 mr-2" />
              View All Projects →
            </Link>
            <br />
            <Link 
              href="/company-dashboard/restore" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Restore from Backup →
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}