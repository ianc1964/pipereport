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
  
  // Edit states - using IDs instead of objects
  const [editingPlanId, setEditingPlanId] = useState(null)
  const [editingPackId, setEditingPackId] = useState(null)
  const [editingPlanData, setEditingPlanData] = useState(null)
  const [editingPackData, setEditingPackData] = useState(null)
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

  const startEditingPlan = (plan) => {
    setEditingPlanId(plan.id)
    setEditingPlanData({ ...plan })
  }

  const cancelEditingPlan = () => {
    setEditingPlanId(null)
    setEditingPlanData(null)
  }

  const startEditingPack = (pack) => {
    setEditingPackId(pack.id)
    setEditingPackData({ ...pack })
  }

  const cancelEditingPack = () => {
    setEditingPackId(null)
    setEditingPackData(null)
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
            price_pennies: parseInt(plan.price_pennies) || 0,
            credits: parseInt(plan.credits) || 0,
            duration_months: parseInt(plan.duration_months) || 1,
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
            price_pennies: parseInt(plan.price_pennies) || 0,
            credits: parseInt(plan.credits) || 0,
            duration_months: parseInt(plan.duration_months) || 1,
            is_active: plan.is_active,
            sort_order: parseInt(plan.sort_order) || 0
          })
        
        if (error) throw error
      }
      
      cancelEditingPlan()
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
            credits: parseInt(pack.credits) || 0,
            price_pennies: parseInt(pack.price_pennies) || 0,
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
            credits: parseInt(pack.credits) || 0,
            price_pennies: parseInt(pack.price_pennies) || 0,
            is_active: pack.is_active,
            sort_order: parseInt(pack.sort_order) || 0
          })
        
        if (error) throw error
      }
      
      cancelEditingPack()
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
    
    // Check if plan is being used by any subscriptions
    try {
      const { data: subscriptions, error: checkError } = await supabase
        .from('subscriptions')
        .select('id, companies(name)')
        .eq('subscription_plan_id', id)
        .limit(5)
      
      if (checkError) throw checkError
      
      if (subscriptions && subscriptions.length > 0) {
        const companyNames = subscriptions.map(s => s.companies?.name || 'Unknown').join(', ')
        const message = `Cannot delete this plan because it's currently being used by ${subscriptions.length} subscription(s) (${companyNames}${subscriptions.length > 5 ? ' and others' : ''}).\n\nYou can deactivate this plan instead to prevent new subscriptions while keeping existing ones.`
        
        if (confirm(message + '\n\nWould you like to deactivate this plan instead?')) {
          // Deactivate the plan instead
          const { error } = await supabase
            .from('subscription_plans')
            .update({ is_active: false })
            .eq('id', id)
          
          if (error) throw error
          await loadData()
          alert('Plan has been deactivated. Existing subscriptions will continue, but no new subscriptions can be created with this plan.')
        }
        return
      }
    } catch (error) {
      console.error('Error checking subscriptions:', error)
      alert('Failed to check if plan is in use: ' + error.message)
      return
    }
    
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) return
    
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      await loadData()
      alert('Plan deleted successfully.')
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan: ' + error.message)
    }
  }

  const handleDeletePack = async (id) => {
    // Check if pack is being used by any purchase history
    try {
      const { data: purchases, error: checkError } = await supabase
        .from('purchase_history')
        .select('id, companies(name)')
        .eq('credit_pack_id', id)
        .limit(5)
      
      if (checkError) throw checkError
      
      if (purchases && purchases.length > 0) {
        const companyNames = purchases.map(p => p.companies?.name || 'Unknown').join(', ')
        const message = `Cannot delete this credit pack because it has been purchased ${purchases.length} time(s) (${companyNames}${purchases.length > 5 ? ' and others' : ''}).\n\nYou can deactivate this pack instead to prevent new purchases while keeping the purchase history.`
        
        if (confirm(message + '\n\nWould you like to deactivate this pack instead?')) {
          // Deactivate the pack instead
          const { error } = await supabase
            .from('credit_packs')
            .update({ is_active: false })
            .eq('id', id)
          
          if (error) throw error
          await loadData()
          alert('Credit pack has been deactivated. Purchase history is preserved, but this pack is no longer available for new purchases.')
        }
        return
      }
    } catch (error) {
      console.error('Error checking purchases:', error)
      alert('Failed to check if pack is in use: ' + error.message)
      return
    }
    
    if (!confirm('Are you sure you want to delete this credit pack? This action cannot be undone.')) return
    
    try {
      const { error } = await supabase
        .from('credit_packs')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      await loadData()
      alert('Credit pack deleted successfully.')
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

  const PlanRow = ({ plan, isEditing, editData, onFieldChange, onSave, onCancel }) => {
    const isTrial = plan.name?.toLowerCase() === 'trial'
    const displayData = isEditing ? editData : plan
    
    if (isEditing) {
      return (
        <tr className="bg-blue-50">
          <td className="px-6 py-4">
            <input
              type="text"
              value={editData?.name || ''}
              onChange={(e) => onFieldChange({ ...editData, name: e.target.value })}
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
              value={editData?.description || ''}
              onChange={(e) => onFieldChange({ ...editData, description: e.target.value })}
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={editData?.price_pennies || 0}
              onChange={(e) => onFieldChange({ ...editData, price_pennies: e.target.value })}
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
              value={editData?.credits || 0}
              onChange={(e) => onFieldChange({ ...editData, credits: e.target.value })}
              className="w-24 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={editData?.duration_months || 1}
              onChange={(e) => onFieldChange({ ...editData, duration_months: e.target.value })}
              className="w-20 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="checkbox"
              checked={editData?.is_active || false}
              onChange={(e) => onFieldChange({ ...editData, is_active: e.target.checked })}
              className="w-4 h-4"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={editData?.sort_order || 0}
              onChange={(e) => onFieldChange({ ...editData, sort_order: e.target.value })}
              className="w-16 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <div className="flex space-x-2">
              <button
                onClick={() => onSave(editData)}
                disabled={saving}
                className="text-green-600 hover:text-green-900 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
              <button
                onClick={onCancel}
                disabled={saving}
                className="text-red-600 hover:text-red-900 disabled:opacity-50"
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
            {displayData.name}
            {isTrial && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                <Sparkles className="w-3 h-3 mr-1" />
                Default Trial
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">{displayData.description}</td>
        <td className="px-6 py-4">
          {isTrial ? (
            <span className="text-green-600 font-medium">Free</span>
          ) : (
            formatPrice(displayData.price_pennies)
          )}
        </td>
        <td className="px-6 py-4">{displayData.credits?.toLocaleString()}</td>
        <td className="px-6 py-4">{formatDuration(displayData.duration_months)}</td>
        <td className="px-6 py-4">
          {displayData.is_active ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <X className="w-4 h-4 text-red-600" />
          )}
        </td>
        <td className="px-6 py-4">{displayData.sort_order}</td>
        <td className="px-6 py-4">
          <div className="flex space-x-2">
            <button
              onClick={() => startEditingPlan(plan)}
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

  const PackRow = ({ pack, isEditing, editData, onFieldChange, onSave, onCancel }) => {
    const displayData = isEditing ? editData : pack
    
    if (isEditing) {
      return (
        <tr className="bg-blue-50">
          <td className="px-6 py-4">
            <input
              type="text"
              value={editData?.name || ''}
              onChange={(e) => onFieldChange({ ...editData, name: e.target.value })}
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="text"
              value={editData?.description || ''}
              onChange={(e) => onFieldChange({ ...editData, description: e.target.value })}
              className="w-full px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={editData?.credits || 0}
              onChange={(e) => onFieldChange({ ...editData, credits: e.target.value })}
              className="w-24 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={editData?.price_pennies || 0}
              onChange={(e) => onFieldChange({ ...editData, price_pennies: e.target.value })}
              className="w-24 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="checkbox"
              checked={editData?.is_active || false}
              onChange={(e) => onFieldChange({ ...editData, is_active: e.target.checked })}
              className="w-4 h-4"
            />
          </td>
          <td className="px-6 py-4">
            <input
              type="number"
              value={editData?.sort_order || 0}
              onChange={(e) => onFieldChange({ ...editData, sort_order: e.target.value })}
              className="w-16 px-2 py-1 border rounded"
            />
          </td>
          <td className="px-6 py-4">
            <div className="flex space-x-2">
              <button
                onClick={() => onSave(editData)}
                disabled={saving}
                className="text-green-600 hover:text-green-900 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
              <button
                onClick={onCancel}
                disabled={saving}
                className="text-red-600 hover:text-red-900 disabled:opacity-50"
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
        <td className="px-6 py-4 font-medium">{displayData.name}</td>
        <td className="px-6 py-4 text-sm text-gray-600">{displayData.description}</td>
        <td className="px-6 py-4">{displayData.credits?.toLocaleString()}</td>
        <td className="px-6 py-4">{formatPrice(displayData.price_pennies)}</td>
        <td className="px-6 py-4">
          {displayData.is_active ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <X className="w-4 h-4 text-red-600" />
          )}
        </td>
        <td className="px-6 py-4">{displayData.sort_order}</td>
        <td className="px-6 py-4">
          <div className="flex space-x-2">
            <button
              onClick={() => startEditingPack(pack)}
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
                      editData={newPlan}
                      onFieldChange={setNewPlan}
                      onSave={handleSavePlan}
                      onCancel={() => setNewPlan(null)}
                    />
                  )}
                  {subscriptionPlans.map((plan) => (
                    <PlanRow
                      key={plan.id}
                      plan={plan}
                      isEditing={editingPlanId === plan.id}
                      editData={editingPlanData}
                      onFieldChange={setEditingPlanData}
                      onSave={handleSavePlan}
                      onCancel={cancelEditingPlan}
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
                      editData={newPack}
                      onFieldChange={setNewPack}
                      onSave={handleSavePack}
                      onCancel={() => setNewPack(null)}
                    />
                  )}
                  {creditPacks.map((pack) => (
                    <PackRow
                      key={pack.id}
                      pack={pack}
                      isEditing={editingPackId === pack.id}
                      editData={editingPackData}
                      onFieldChange={setEditingPackData}
                      onSave={handleSavePack}
                      onCancel={cancelEditingPack}
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