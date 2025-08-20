'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import { 
  ChevronLeft, 
  CreditCard, 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  Check,
  X,
  Save,
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react'

export default function AdminSubscriptionsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Data states
  const [subscriptionPlans, setSubscriptionPlans] = useState([])
  const [creditPacks, setCreditPacks] = useState([])
  
  // Edit states
  const [editingPlan, setEditingPlan] = useState(null)
  const [editingPack, setEditingPack] = useState(null)
  const [newPlan, setNewPlan] = useState(null)
  const [newPack, setNewPack] = useState(null)

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [authLoading, user])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load subscription plans
      const { data: plans, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true })
      
      if (plansError) throw plansError
      setSubscriptionPlans(plans || [])
      
      // Load credit packs
      const { data: packs, error: packsError } = await supabase
        .from('credit_packs')
        .select('*')
        .order('sort_order', { ascending: true })
      
      if (packsError) throw packsError
      setCreditPacks(packs || [])
      
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePlan = async (plan) => {
    try {
      setSaving(true)
      
      // Don't allow changing the trial plan name
      const isTrial = plan.id && subscriptionPlans.find(p => p.id === plan.id)?.name?.toLowerCase() === 'trial'
      if (isTrial && plan.name.toLowerCase() !== 'trial') {
        alert('Cannot change the name of the Trial plan. The system depends on this name.')
        return
      }
      
      if (plan.id) {
        // Update existing
        const { error } = await supabase
          .from('subscription_plans')
          .update({
            name: plan.name,
            description: plan.description,
            price_pennies: parseInt(plan.price_pennies),
            credits: parseInt(plan.credits),
            duration_months: parseInt(plan.duration_months),
            is_active: plan.is_active,
            sort_order: parseInt(plan.sort_order) || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.id)
        
        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('subscription_plans')
          .insert({
            name: plan.name,
            description: plan.description,
            price_pennies: parseInt(plan.price_pennies),
            credits: parseInt(plan.credits),
            duration_months: parseInt(plan.duration_months),
            is_active: plan.is_active,
            sort_order: parseInt(plan.sort_order) || 0
          })
        
        if (error) throw error
      }
      
      setEditingPlan(null)
      setNewPlan(null)
      await loadData()
    } catch (error) {
      console.error('Error saving plan:', error)
      alert('Failed to save plan: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePack = async (pack) => {
    try {
      setSaving(true)
      
      if (pack.id) {
        // Update existing
        const { error } = await supabase
          .from('credit_packs')
          .update({
            name: pack.name,
            description: pack.description,
            credits: parseInt(pack.credits),
            price_pennies: parseInt(pack.price_pennies),
            is_active: pack.is_active,
            sort_order: parseInt(pack.sort_order) || 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', pack.id)
        
        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('credit_packs')
          .insert({
            name: pack.name,
            description: pack.description,
            credits: parseInt(pack.credits),
            price_pennies: parseInt(pack.price_pennies),
            is_active: pack.is_active,
            sort_order: parseInt(pack.sort_order) || 0
          })
        
        if (error) throw error
      }
      
      setEditingPack(null)
      setNewPack(null)
      await loadData()
    } catch (error) {
      console.error('Error saving pack:', error)
      alert('Failed to save pack: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlan = async (id) => {
    const plan = subscriptionPlans.find(p => p.id === id)
    if (plan?.name?.toLowerCase() === 'trial') {
      alert('Cannot delete the Trial plan. This is required for new signups.')
      return
    }
    
    if (!confirm('Are you sure you want to delete this plan?')) return
    
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan: ' + error.message)
    }
  }

  const handleDeletePack = async (id) => {
    if (!confirm('Are you sure you want to delete this pack?')) return
    
    try {
      const { error } = await supabase
        .from('credit_packs')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting pack:', error)
      alert('Failed to delete pack: ' + error.message)
    }
  }

  const formatPrice = (pennies) => {
    return `£${(pennies / 100).toFixed(2)}`
  }

  const formatDuration = (months) => {
    if (months === 1) return '1 month'
    if (months < 1) return `${Math.round(months * 30)} days`
    return `${months} months`
  }

  const PlanRow = ({ plan, isEditing, onChange, onSave, onCancel }) => {
    const isTrial = plan.name?.toLowerCase() === 'trial'
    
    if (isEditing) {
      return (
        <tr className="bg-blue-50">
          <td className="px-6 py-4">
            <input
              type="text"
              value={plan.name}
              onChange={(e) => onChange({ ...plan, name: e.target.value })}
              className="w-full px-2 py-1 border rounded"
              disabled={isTrial}
            />
            {isTrial && (
              <p className="text-xs text-gray-500 mt-1">Name cannot be changed for trial plan</p>
            )}
          </td>
          <td className="px-6 py-4">
            <input
              type="text"
              value={plan.description}
              onChange={(e) => onChange({ ...plan, description: e.target.value })}
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={plan.price_pennies}
              onChange={(e) => onChange({ ...plan, price_pennies: e.target.value })}
              className="w-24 px-2 py-1 border rounded"
              disabled={isTrial}
            />
            {isTrial && (
              <p className="text-xs text-gray-500 mt-1">Must be free</p>
            )}
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={plan.credits}
              onChange={(e) => onChange({ ...plan, credits: e.target.value })}
              className="w-24 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={plan.duration_months}
              onChange={(e) => onChange({ ...plan, duration_months: e.target.value })}
              className="w-20 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="checkbox"
              checked={plan.is_active}
              onChange={(e) => onChange({ ...plan, is_active: e.target.checked })}
              className="w-4 h-4"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={plan.sort_order}
              onChange={(e) => onChange({ ...plan, sort_order: e.target.value })}
              className="w-16 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <div className="flex space-x-2">
              <button
                onClick={() => onSave(plan)}
                disabled={saving}
                className="text-green-600 hover:text-green-900"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
              <button
                onClick={onCancel}
                className="text-red-600 hover:text-red-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      )
    }

    return (
      <tr className={`hover:bg-gray-50 ${isTrial ? 'bg-blue-50' : ''}`}>
        <td className="px-6 py-4 font-medium">
          <div className="flex items-center">
            {plan.name}
            {isTrial && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                <Sparkles className="w-3 h-3 mr-1" />
                Default Trial
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">{plan.description}</td>
        <td className="px-6 py-4">
          {isTrial ? (
            <span className="text-green-600 font-medium">Free</span>
          ) : (
            formatPrice(plan.price_pennies)
          )}
        </td>
        <td className="px-6 py-4">{plan.credits.toLocaleString()}</td>
        <td className="px-6 py-4">{formatDuration(plan.duration_months)}</td>
        <td className="px-6 py-4">
          {plan.is_active ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <X className="w-4 h-4 text-red-600" />
          )}
        </td>
        <td className="px-6 py-4">{plan.sort_order}</td>
        <td className="px-6 py-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setEditingPlan(plan)}
              className="text-blue-600 hover:text-blue-900"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {!isTrial && (
              <button
                onClick={() => handleDeletePlan(plan.id)}
                className="text-red-600 hover:text-red-900"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const PackRow = ({ pack, isEditing, onChange, onSave, onCancel }) => {
    if (isEditing) {
      return (
        <tr className="bg-blue-50">
          <td className="px-6 py-4">
            <input
              type="text"
              value={pack.name}
              onChange={(e) => onChange({ ...pack, name: e.target.value })}
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="text"
              value={pack.description}
              onChange={(e) => onChange({ ...pack, description: e.target.value })}
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={pack.credits}
              onChange={(e) => onChange({ ...pack, credits: e.target.value })}
              className="w-24 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={pack.price_pennies}
              onChange={(e) => onChange({ ...pack, price_pennies: e.target.value })}
              className="w-24 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="checkbox"
              checked={pack.is_active}
              onChange={(e) => onChange({ ...pack, is_active: e.target.checked })}
              className="w-4 h-4"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={pack.sort_order}
              onChange={(e) => onChange({ ...pack, sort_order: e.target.value })}
              className="w-16 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <div className="flex space-x-2">
              <button
                onClick={() => onSave(pack)}
                disabled={saving}
                className="text-green-600 hover:text-green-900"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
              <button
                onClick={onCancel}
                className="text-red-600 hover:text-red-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      )
    }

    return (
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 font-medium">{pack.name}</td>
        <td className="px-6 py-4 text-sm text-gray-600">{pack.description}</td>
        <td className="px-6 py-4">{pack.credits.toLocaleString()}</td>
        <td className="px-6 py-4">{formatPrice(pack.price_pennies)}</td>
        <td className="px-6 py-4">
          {pack.is_active ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <X className="w-4 h-4 text-red-600" />
          )}
        </td>
        <td className="px-6 py-4">{pack.sort_order}</td>
        <td className="px-6 py-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setEditingPack(pack)}
              className="text-blue-600 hover:text-blue-900"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeletePack(pack.id)}
              className="text-red-600 hover:text-red-900"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  const hasTrialPlan = subscriptionPlans.some(p => p.name?.toLowerCase() === 'trial')

  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/admin"
                className="text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <CreditCard className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Subscription & Credit Management
                </h1>
                <p className="text-sm text-gray-600">
                  Configure subscription plans and credit packs
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Trial Plan Info Box */}
          {hasTrialPlan && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-blue-400 mr-2 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Trial Plan Configuration</p>
                  <p>The "Trial" subscription plan is automatically assigned to new signups. Edit it to change the default trial duration and credits. The trial plan must always be free and cannot be renamed or deleted.</p>
                </div>
              </div>
            </div>
          )}

          {/* Subscription Plans Section */}
          <div className="bg-white shadow-sm rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Subscription Plans</h2>
              <button
                onClick={() => setNewPlan({
                  name: '',
                  description: '',
                  price_pennies: 0,
                  credits: 0,
                  duration_months: 12,
                  is_active: true,
                  sort_order: subscriptionPlans.length + 1
                })}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Plan</span>
              </button>
            </div>
            
            {!hasTrialPlan && (
              <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
                <div className="flex items-center text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  <span>No trial plan found! Create a plan named "Trial" to enable free trials for new signups.</span>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {newPlan && (
                    <PlanRow
                      plan={newPlan}
                      isEditing={true}
                      onChange={setNewPlan}
                      onSave={handleSavePlan}
                      onCancel={() => setNewPlan(null)}
                    />
                  )}
                  {subscriptionPlans.map((plan) => (
                    <PlanRow
                      key={plan.id}
                      plan={plan}
                      isEditing={editingPlan?.id === plan.id}
                      onChange={setEditingPlan}
                      onSave={handleSavePlan}
                      onCancel={() => setEditingPlan(null)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit Packs Section */}
          <div className="bg-white shadow-sm rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Credit Packs</h2>
              <button
                onClick={() => setNewPack({
                  name: '',
                  description: '',
                  credits: 0,
                  price_pennies: 0,
                  is_active: true,
                  sort_order: creditPacks.length + 1
                })}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Add Pack</span>
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {newPack && (
                    <PackRow
                      pack={newPack}
                      isEditing={true}
                      onChange={setNewPack}
                      onSave={handleSavePack}
                      onCancel={() => setNewPack(null)}
                    />
                  )}
                  {creditPacks.map((pack) => (
                    <PackRow
                      key={pack.id}
                      pack={pack}
                      isEditing={editingPack?.id === pack.id}
                      onChange={setEditingPack}
                      onSave={handleSavePack}
                      onCancel={() => setEditingPack(null)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Subscription Management</h3>
            <p className="text-gray-700">
              These plans and packs are configured for future Stripe integration. Currently, you can manually 
              assign subscriptions and add credits to companies from the Companies page.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}