'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import CompanyIPInfo from '@/components/CompanyIPInfo'
import { 
  getCreditBalance, 
  getCreditTransactions, 
  addCredits, 
  consumeCredits,
  formatCredits,
  getOperationDisplayName 
} from '@/lib/credits'
import { 
  ArrowLeft, 
  Building2, 
  CreditCard, 
  Users, 
  Mail, 
  Phone, 
  Calendar,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Edit2,
  Save,
  X,
  UserCheck,
  AtSign,
  Package,
  Loader2,
  Trash2
} from 'lucide-react'

export default function CompanyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [company, setCompany] = useState(null)
  const [companyAdmin, setCompanyAdmin] = useState(null)
  const [users, setUsers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [creditStats, setCreditStats] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  
  // Credit adjustment modal
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditAction, setCreditAction] = useState('add') // 'add' or 'remove'
  const [creditAmount, setCreditAmount] = useState('')
  const [creditDescription, setCreditDescription] = useState('')

  // Subscription management states
  const [subscriptionPlans, setSubscriptionPlans] = useState([])
  const [creditPacks, setCreditPacks] = useState([])
  const [activeSubscription, setActiveSubscription] = useState(null)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [showCreditPackModal, setShowCreditPackModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [selectedPack, setSelectedPack] = useState(null)
  const [assigningSubscription, setAssigningSubscription] = useState(false)

  useEffect(() => {
    loadCompanyData()
    loadPlansAndPacks()
  }, [params.id])

  async function loadCompanyData() {
    try {
      setLoading(true)
      setError(null)
      
      // Load company data
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', params.id)
        .single()
      
      if (companyError) throw companyError
      
      setCompany(companyData)
      setEditForm(companyData)
      
      // Load credit balance
      const balance = await getCreditBalance(params.id)
      console.log('Credit balance:', balance)
      setCreditStats(balance)
      
      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', params.id)
        .order('created_at', { ascending: false })
      
      if (usersError) throw usersError
      setUsers(usersData || [])
      
      // Find the company admin
      const admin = usersData?.find(u => u.role === 'company_admin')
      setCompanyAdmin(admin)
      
      // Load recent transactions
      const transactionsData = await getCreditTransactions(params.id, { limit: 10 })
      setTransactions(transactionsData)

      // Load active subscription
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('company_id', params.id)
        .eq('status', 'active')
        .single()
      
      setActiveSubscription(subscriptionData)
      
    } catch (err) {
      console.error('Error loading company data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadPlansAndPacks() {
    try {
      // Load subscription plans
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      
      setSubscriptionPlans(plans || [])
      
      // Load credit packs
      const { data: packs } = await supabase
        .from('credit_packs')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      
      setCreditPacks(packs || [])
      
    } catch (error) {
      console.error('Error loading plans/packs:', error)
    }
  }

  async function handleSaveCompany() {
    try {
      setSaving(true)
      setError(null)
      
      const { error } = await supabase
        .from('companies')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          subscription_status: editForm.subscription_status,
          subscription_end_date: editForm.subscription_end_date
        })
        .eq('id', params.id)
      
      if (error) throw error
      
      setCompany(editForm)
      setIsEditing(false)
      setSuccess('Company details updated successfully')
      setTimeout(() => setSuccess(null), 3000)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreditAdjustment() {
    try {
      setSaving(true)
      setError(null)
      
      const amount = parseInt(creditAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount')
      }
      
      if (creditAction === 'add') {
        const result = await addCredits(
          params.id,
          user.id,
          amount,
          'manual_adjustment',
          creditDescription || 'Manual credit addition by admin'
        )
        
        console.log('Add credits result:', result)
        
        if (!result.success) throw new Error(result.error)
        
        setSuccess(`Successfully added ${formatCredits(amount)} credits`)
      } else {
        const result = await consumeCredits(
          params.id,
          user.id,
          amount,
          'manual_adjustment',
          creditDescription || 'Manual credit deduction by admin'
        )
        
        console.log('Consume credits result:', result)
        
        if (!result.success) throw new Error(result.error)
        
        setSuccess(`Successfully removed ${formatCredits(amount)} credits`)
      }
      
      // Reload data
      await loadCompanyData()
      
      // Also refresh the auth context to update navigation credits
      if (refreshProfile) {
        refreshProfile()
      }
      
      // Reset modal
      setShowCreditModal(false)
      setCreditAmount('')
      setCreditDescription('')
      setTimeout(() => setSuccess(null), 3000)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignSubscription() {
    if (!selectedPlan) return
    
    try {
      setAssigningSubscription(true)
      setError(null)
      
      // If there's an active subscription, cancel it first
      if (activeSubscription) {
        const { error: cancelError } = await supabase.rpc('cancel_existing_subscriptions', {
          p_company_id: company.id
        })
        
        if (cancelError) {
          console.error('Error cancelling existing subscription:', cancelError)
          // Continue anyway - we'll still try to create the new subscription
        }
      }
      
      // Calculate end date
      const startDate = new Date()
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + selectedPlan.duration_months)
      
      // Create subscription record
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          company_id: company.id,
          subscription_plan_id: selectedPlan.id,
          status: 'active',
          current_period_start: startDate.toISOString(),
          current_period_end: endDate.toISOString()
        })
        .select()
        .single()
      
      if (subError) throw subError
      
      // Add credits using the manual adjustment method
      const result = await addCredits(
        params.id,
        user.id,
        selectedPlan.credits,
        'subscription',
        `${selectedPlan.name} subscription activated`
      )
      
      if (!result.success) throw new Error(result.error)
      
      // Update company
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          subscription_status: 'active',
          subscription_end_date: endDate.toISOString(),
          subscription_id: subscription.id
        })
        .eq('id', company.id)
      
      if (updateError) throw updateError
      
      await loadCompanyData()
      setShowSubscriptionModal(false)
      setSelectedPlan(null)
      setSuccess('Subscription assigned successfully!')
      setTimeout(() => setSuccess(null), 5000)
      
    } catch (error) {
      console.error('Error assigning subscription:', error)
      setError('Failed to assign subscription: ' + error.message)
    } finally {
      setAssigningSubscription(false)
    }
  }

  async function handleCancelSubscription() {
    if (!activeSubscription || !confirm('Are you sure you want to cancel this subscription? The company will keep their current credits.')) {
      return
    }
    
    try {
      setError(null)
      
      // Cancel the subscription
      const { error: cancelError } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeSubscription.id)
      
      if (cancelError) throw cancelError
      
      // Update company status
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          subscription_status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', company.id)
      
      if (updateError) throw updateError
      
      await loadCompanyData()
      setSuccess('Subscription cancelled successfully')
      setTimeout(() => setSuccess(null), 5000)
      
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      setError('Failed to cancel subscription: ' + error.message)
    }
  }

  async function handleAssignCreditPack() {
    if (!selectedPack) return
    
    try {
      setAssigningSubscription(true)
      setError(null)
      
      // Add credits
      const result = await addCredits(
        params.id,
        user.id,
        selectedPack.credits,
        'credit_pack',
        `${selectedPack.name} credit pack`
      )
      
      if (!result.success) throw new Error(result.error)
      
      // Create purchase history record
      const { error: purchaseError } = await supabase
        .from('purchase_history')
        .insert({
          company_id: company.id,
          user_id: user.id,
          type: 'credit_pack',
          credit_pack_id: selectedPack.id,
          amount_pennies: selectedPack.price_pennies,
          credits_added: selectedPack.credits,
          status: 'completed',
          description: `Manual assignment: ${selectedPack.name}`
        })
      
      if (purchaseError) throw purchaseError
      
      await loadCompanyData()
      setShowCreditPackModal(false)
      setSelectedPack(null)
      setSuccess('Credit pack assigned successfully!')
      setTimeout(() => setSuccess(null), 5000)
      
    } catch (error) {
      console.error('Error assigning credit pack:', error)
      setError('Failed to assign credit pack: ' + error.message)
    } finally {
      setAssigningSubscription(false)
    }
  }

  function formatPrice(pennies) {
    return `£${(pennies / 100).toFixed(2)}`
  }

  function getStatusColor(status) {
    switch(status) {
      case 'active': return 'text-green-600 bg-green-50'
      case 'trial': return 'text-blue-600 bg-blue-50'
      case 'suspended': return 'text-red-600 bg-red-50'
      case 'cancelled': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  function getRoleColor(role) {
    switch(role) {
      case 'company_admin': return 'text-purple-600 bg-purple-50'
      case 'user': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading company details...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!company) {
    return (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Company not found</p>
            <Link href="/admin/companies" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Back to companies
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin/companies" className="text-blue-600 hover:text-blue-800 flex items-center mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to companies
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Building2 className="w-8 h-8 mr-3 text-gray-600" />
                {company.name}
              </h1>
              <p className="text-gray-600 mt-1">Company ID: {company.id}</p>
            </div>
            
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(company.subscription_status)}`}>
              {company.subscription_status}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <p className="text-sm text-green-700 mt-1">{success}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Company Details */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-900">Company Details</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  ) : (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveCompany}
                        disabled={saving}
                        className="text-green-600 hover:text-green-800 disabled:opacity-50"
                      >
                        <Save className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false)
                          setEditForm(company)
                        }}
                        disabled={saving}
                        className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{company.name}</p>
                  )}
                </div>
                
                {/* Email Section - Now shows both contact and login emails */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Contact Email
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="General contact email for the company"
                      />
                    ) : (
                      <p className="mt-1 text-gray-900">{company.email || '-'}</p>
                    )}
                  </div>
                  
                  {/* Company Admin Login Email (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <AtSign className="w-4 h-4 inline mr-1" />
                      Admin Login Email
                    </label>
                    <p className="mt-1 text-gray-900">
                      {companyAdmin ? (
                        <span className="flex items-center">
                          <UserCheck className="w-4 h-4 mr-2 text-purple-600" />
                          {companyAdmin.email}
                          {companyAdmin.full_name && (
                            <span className="text-gray-500 ml-2">({companyAdmin.full_name})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-500">No company admin assigned</span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="mt-1 text-gray-900">{company.phone || '-'}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Subscription Status
                    </label>
                    {isEditing ? (
                      <select
                        value={editForm.subscription_status || ''}
                        onChange={(e) => setEditForm({...editForm, subscription_status: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <p className={`mt-1 inline-flex px-2 py-1 text-xs rounded-full ${getStatusColor(company.subscription_status)}`}>
                        {company.subscription_status}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Subscription End Date
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editForm.subscription_end_date || ''}
                        onChange={(e) => setEditForm({...editForm, subscription_end_date: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="mt-1 text-gray-900">
                        {company.subscription_end_date 
                          ? new Date(company.subscription_end_date).toLocaleDateString()
                          : '-'
                        }
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Created
                  </label>
                  <p className="mt-1 text-gray-900">
                    {new Date(company.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Subscription */}
            {activeSubscription && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-green-900">Active Subscription</h3>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <button
                      onClick={handleCancelSubscription}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-green-800">
                  <p><span className="font-medium">Plan:</span> {activeSubscription.subscription_plans?.name}</p>
                  <p><span className="font-medium">Credits:</span> {activeSubscription.subscription_plans?.credits?.toLocaleString()}</p>
                  <p><span className="font-medium">Ends:</span> {new Date(activeSubscription.current_period_end).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            {/* Subscription Management */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Subscription Management
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Assign Subscription</span>
                </button>
                <button
                  onClick={() => setShowCreditPackModal(true)}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Package className="w-5 h-5" />
                  <span>Add Credit Pack</span>
                </button>
              </div>
            </div>

            {/* Users */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Users ({users.length})
                </h2>
              </div>
              
              <div className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No users in this company
                  </div>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="px-6 py-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name || 'Unnamed User'}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(user.role)}`}>
                          {user.role === 'company_admin' && <UserCheck className="w-3 h-3 inline mr-1" />}
                          {user.role}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* IP Address Tracking */}
          <CompanyIPInfo 
            companyId={params.id} 
            companyName={company.name} 
          />

          {/* Right Column */}
          <div className="space-y-6">
            {/* Credits */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Credits
                </h2>
              </div>
              
              <div className="px-6 py-4">
                {creditStats && (
                  <>
                    <div className="text-center mb-6">
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCredits(creditStats.balance)}
                      </p>
                      <p className="text-sm text-gray-600">Current Balance</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-lg font-medium text-green-600 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 mr-1" />
                          {formatCredits(creditStats.totalPurchased)}
                        </p>
                        <p className="text-xs text-gray-600">Total Added</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-medium text-red-600 flex items-center justify-center">
                          <TrendingDown className="w-4 h-4 mr-1" />
                          {formatCredits(creditStats.totalConsumed)}
                        </p>
                        <p className="text-xs text-gray-600">Total Used</p>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setCreditAction('add')
                      setShowCreditModal(true)
                    }}
                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setCreditAction('remove')
                      setShowCreditModal(true)
                    }}
                    className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4 mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Transactions</h2>
              </div>
              
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {transactions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No transactions yet
                  </div>
                ) : (
                  transactions.map((transaction) => (
                    <div key={transaction.id} className="px-6 py-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-gray-600">
                            {new Date(transaction.created_at).toLocaleString()}
                          </p>
                          {transaction.profiles && (
                            <p className="text-xs text-gray-500">
                              by {transaction.profiles.full_name || transaction.profiles.email}
                            </p>
                          )}
                        </div>
                        <p className={`text-sm font-medium ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{formatCredits(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {transactions.length > 0 && (
                <div className="px-6 py-3 border-t border-gray-200">
                  <Link href={`/admin/companies/${params.id}/transactions`} className="text-sm text-blue-600 hover:text-blue-800">
                    View all transactions →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Credit Adjustment Modal */}
        {showCreditModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {creditAction === 'add' ? 'Add Credits' : 'Remove Credits'}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    min="1"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description (optional)
                  </label>
                  <textarea
                    value={creditDescription}
                    onChange={(e) => setCreditDescription(e.target.value)}
                    placeholder="Enter reason for adjustment"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    rows="3"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => {
                    setShowCreditModal(false)
                    setCreditAmount('')
                    setCreditDescription('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreditAdjustment}
                  disabled={saving || !creditAmount}
                  className={`flex-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    creditAction === 'add' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  } disabled:opacity-50`}
                >
                  {saving ? 'Processing...' : creditAction === 'add' ? 'Add Credits' : 'Remove Credits'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Modal */}
        {showSubscriptionModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">Assign Subscription Plan</h3>
              
              {activeSubscription && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex">
                    <AlertCircle className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-amber-800">
                        <strong>Warning:</strong> This company already has an active subscription ({activeSubscription.subscription_plans?.name}). 
                        Assigning a new subscription will cancel the existing one.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {subscriptionPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`border rounded-lg p-4 cursor-pointer ${
                      selectedPlan?.id === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{plan.name}</h4>
                        <p className="text-sm text-gray-600">{plan.description}</p>
                        <p className="text-sm mt-2">
                          <span className="font-medium">Duration:</span> {plan.duration_months} months
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          {plan.credits.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">credits</p>
                        <p className="text-lg font-semibold mt-2">
                          {formatPrice(plan.price_pennies)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowSubscriptionModal(false)
                    setSelectedPlan(null)
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignSubscription}
                  disabled={!selectedPlan || assigningSubscription}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center"
                >
                  {assigningSubscription ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    activeSubscription ? 'Replace Subscription' : 'Assign Subscription'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credit Pack Modal */}
        {showCreditPackModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">Add Credit Pack</h3>
              <div className="space-y-4">
                {creditPacks.map((pack) => (
                  <div
                    key={pack.id}
                    className={`border rounded-lg p-4 cursor-pointer ${
                      selectedPack?.id === pack.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedPack(pack)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{pack.name}</h4>
                        <p className="text-sm text-gray-600">{pack.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600">
                          {pack.credits.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">credits</p>
                        <p className="text-lg font-semibold mt-2">
                          {formatPrice(pack.price_pennies)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => {
                    setShowCreditPackModal(false)
                    setSelectedPack(null)
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignCreditPack}
                  disabled={!selectedPack || assigningSubscription}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
                >
                  {assigningSubscription ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Credit Pack'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}