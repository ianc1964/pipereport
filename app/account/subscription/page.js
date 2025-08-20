'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { 
  getActiveSubscriptionPlans, 
  getActiveCreditPacks,
  getCompanySubscription,
  formatPrice
} from '@/lib/subscriptions'
import { 
  ArrowLeft,
  CreditCard, 
  Package, 
  Check,
  Clock,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  Coins
} from 'lucide-react'

export default function SubscriptionPage() {
  const router = useRouter()
  const { user, profile, company, subscriptionStatus, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [subscriptionPlans, setSubscriptionPlans] = useState([])
  const [creditPacks, setCreditPacks] = useState([])
  const [currentSubscription, setCurrentSubscription] = useState(null)
  const [activeTab, setActiveTab] = useState('subscriptions')

  useEffect(() => {
    // Check URL parameters for tab selection
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'credits') {
      setActiveTab('credits')
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user && company) {
      loadData()
    } else if (!authLoading && (!user || !company)) {
      // Redirect to login if not authenticated or no company
      router.push('/auth/login')
    }
  }, [authLoading, user, company, router])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load subscription plans
      const plans = await getActiveSubscriptionPlans()
      setSubscriptionPlans(plans)
      
      // Load credit packs
      const packs = await getActiveCreditPacks()
      setCreditPacks(packs)
      
      // Load current subscription if exists
      if (company?.id) {
        const subscription = await getCompanySubscription(company.id)
        setCurrentSubscription(subscription)
      }
      
    } catch (error) {
      console.error('Error loading subscription data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  const isExpired = subscriptionStatus?.status === 'expired' || 
                    subscriptionStatus?.status === 'cancelled'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Subscription & Credits</h1>
                <p className="text-sm text-gray-600">Manage your subscription and purchase credits</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Status Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Subscription Status */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Subscription</h3>
              {currentSubscription ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {currentSubscription.subscription_plans?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {subscriptionStatus?.days_remaining > 0 
                      ? `${subscriptionStatus.days_remaining} days remaining`
                      : 'Expired'
                    }
                  </p>
                </div>
              ) : (
                <p className="text-lg font-semibold text-gray-900">
                  {isExpired ? 'Expired' : 'No active subscription'}
                </p>
              )}
            </div>

            {/* Credit Balance */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Credit Balance</h3>
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 text-blue-600" />
                <p className="text-2xl font-bold text-blue-600">
                  {company?.user_credits?.balance?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Company</h3>
              <p className="text-lg font-semibold text-gray-900">{company?.name}</p>
            </div>
          </div>
        </div>

        {/* Expired Alert */}
        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Your subscription has expired
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  You cannot access the system until you renew your subscription. 
                  Your {company?.user_credits?.balance || 0} credits are preserved and will be available when you resubscribe.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'subscriptions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Subscription Plans
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'credits'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Credit Packs
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'subscriptions' ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                    <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
                    
                    <div className="mt-4">
                      <p className="text-3xl font-bold text-gray-900">
                        {formatPrice(plan.price_pennies)}
                      </p>
                      <p className="text-sm text-gray-500">
                        for {plan.duration_months} months
                      </p>
                    </div>
                    
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center">
                        <Check className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-sm text-gray-700">
                          {plan.credits.toLocaleString()} credits included
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-sm text-gray-700">
                          {plan.duration_months} month{plan.duration_months > 1 ? 's' : ''} access
                        </span>
                      </div>
                      {company?.user_credits?.balance > 0 && (
                        <div className="flex items-center">
                          <Coins className="w-5 h-5 text-blue-500 mr-2" />
                          <span className="text-sm text-blue-700">
                            + Your existing {company.user_credits.balance} credits
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-6">
                      <button
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-not-allowed"
                        disabled
                      >
                        Contact Support to Purchase
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {creditPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900">{pack.name}</h3>
                    <p className="mt-2 text-sm text-gray-600">{pack.description}</p>
                    
                    <div className="mt-4">
                      <p className="text-3xl font-bold text-gray-900">
                        {formatPrice(pack.price_pennies)}
                      </p>
                      <p className="text-sm text-gray-500">one-time purchase</p>
                    </div>
                    
                    <div className="mt-6">
                      <div className="flex items-center">
                        <Package className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-sm text-gray-700">
                          {pack.credits.toLocaleString()} credits
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <button
                        className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-not-allowed"
                        disabled
                      >
                        Contact Support to Purchase
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contact Support Section */}
        <div className="mt-12 bg-blue-50 rounded-lg p-8 text-center">
          <CreditCard className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Ready to Purchase?
          </h3>
          <p className="text-gray-700 mb-6">
            Contact our support team to process your subscription or credit pack purchase.
            We'll activate it immediately and you can continue using the system.
          </p>
          <div className="flex justify-center space-x-6">
            <a
              href="mailto:support@example.com"
              className="flex items-center text-blue-600 hover:text-blue-700"
            >
              <Mail className="w-5 h-5 mr-2" />
              support@example.com
            </a>
            <a
              href="tel:+442012345678"
              className="flex items-center text-blue-600 hover:text-blue-700"
            >
              <Phone className="w-5 h-5 mr-2" />
              +44 20 1234 5678
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}