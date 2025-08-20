import { supabase } from './supabase'

/**
 * Get the subscription status for a company
 * @param {string} companyId - The company ID
 * @returns {object} Subscription status including days remaining, status, etc.
 */
export async function getSubscriptionStatus(companyId) {
  if (!companyId) {
    return null
  }
  
  try {
    // Call the database function that checks subscription status
    const { data, error } = await supabase
      .rpc('get_subscription_status', { p_company_id: companyId })
      .single()
    
    if (error) {
      // Return a default status if the function doesn't exist
      if (error.message?.includes('function') || error.code === '42883') {
        return {
          status: 'active',
          days_remaining: 30,
          end_date: null,
          subscription_id: null,
          plan_name: null
        }
      }
      console.error('getSubscriptionStatus: Database error:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('getSubscriptionStatus: Failed to get subscription status:', error)
    return null
  }
}

/**
 * Check if a company's subscription is active
 * @param {string} companyId - The company ID
 * @returns {boolean} True if subscription is active
 */
export async function isSubscriptionActive(companyId) {
  const status = await getSubscriptionStatus(companyId)
  return status?.status === 'active' || status?.status === 'trialing'
}

/**
 * Get active subscription plans
 * @returns {array} List of active subscription plans
 */
export async function getActiveSubscriptionPlans() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return []
  }
}

/**
 * Get active credit packs
 * @returns {array} List of active credit packs
 */
export async function getActiveCreditPacks() {
  try {
    const { data, error } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    
    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching credit packs:', error)
    return []
  }
}

/**
 * Assign a subscription to a company (admin only)
 * @param {string} companyId - The company ID
 * @param {string} subscriptionPlanId - The subscription plan ID
 * @param {string} userId - The user performing the action
 * @returns {object} Result of the subscription assignment
 */
export async function assignSubscription(companyId, subscriptionPlanId, userId) {
  try {
    // First, get the subscription plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', subscriptionPlanId)
      .single()
    
    if (planError) throw planError
    if (!plan) throw new Error('Subscription plan not found')
    
    // Cancel any existing subscriptions
    const { error: cancelError } = await supabase
      .rpc('cancel_existing_subscriptions', { p_company_id: companyId })
    
    if (cancelError) throw cancelError
    
    // Calculate subscription dates
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + plan.duration_months)
    
    // Create the subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        company_id: companyId,
        subscription_plan_id: subscriptionPlanId,
        status: 'active',
        current_period_start: startDate.toISOString(),
        current_period_end: endDate.toISOString()
      })
      .select()
      .single()
    
    if (subError) throw subError
    
    // Update company with subscription info
    const { error: updateError } = await supabase
      .from('companies')
      .update({
        subscription_id: subscription.id,
        subscription_end_date: endDate.toISOString(),
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)
    
    if (updateError) throw updateError
    
    // Add credits using the existing credits function
    const { addCredits } = await import('./credits')
    await addCredits(
      companyId,
      userId,
      plan.credits,
      'subscription',
      `${plan.name} subscription activated`
    )
    
    // Create purchase history record
    const { error: historyError } = await supabase
      .from('purchase_history')
      .insert({
        company_id: companyId,
        purchase_type: 'subscription',
        subscription_plan_id: subscriptionPlanId,
        amount_pennies: plan.price_pennies,
        credits_added: plan.credits,
        processed_by: userId,
        metadata: {
          plan_name: plan.name,
          duration_months: plan.duration_months
        }
      })
    
    if (historyError) {
      console.error('Failed to create purchase history:', historyError)
      // Don't throw - this is not critical
    }
    
    return { success: true, subscription, credits_added: plan.credits }
  } catch (error) {
    console.error('Error assigning subscription:', error)
    throw error
  }
}

/**
 * Add a credit pack to a company (admin only)
 * @param {string} companyId - The company ID
 * @param {string} creditPackId - The credit pack ID
 * @param {string} userId - The user performing the action
 * @returns {object} Result of the credit pack addition
 */
export async function addCreditPack(companyId, creditPackId, userId) {
  try {
    // Get the credit pack details
    const { data: pack, error: packError } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('id', creditPackId)
      .single()
    
    if (packError) throw packError
    if (!pack) throw new Error('Credit pack not found')
    
    // Add credits using the existing credits function
    const { addCredits } = await import('./credits')
    await addCredits(
      companyId,
      userId,
      pack.credits,
      'credit_pack',
      `${pack.name} credit pack purchased`
    )
    
    // Create purchase history record
    const { error: historyError } = await supabase
      .from('purchase_history')
      .insert({
        company_id: companyId,
        purchase_type: 'credit_pack',
        credit_pack_id: creditPackId,
        amount_pennies: pack.price_pennies,
        credits_added: pack.credits,
        processed_by: userId,
        metadata: {
          pack_name: pack.name
        }
      })
    
    if (historyError) {
      console.error('Failed to create purchase history:', historyError)
      // Don't throw - this is not critical
    }
    
    return { success: true, credits_added: pack.credits }
  } catch (error) {
    console.error('Error adding credit pack:', error)
    throw error
  }
}

/**
 * Get company's subscription details
 * @param {string} companyId - The company ID
 * @returns {object} Current subscription details
 */
export async function getCompanySubscription(companyId) {
  if (!companyId) return null
  
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          description,
          credits,
          price_pennies,
          duration_months
        )
      `)
      .eq('company_id', companyId)
      .eq('status', 'active')
      .single()
    
    if (error && error.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching subscription:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Failed to get company subscription:', error)
    return null
  }
}

/**
 * Check and update expired subscriptions
 * This should be called periodically (e.g., hourly cron job)
 */
export async function checkExpiredSubscriptions() {
  try {
    const { error } = await supabase
      .rpc('check_expired_subscriptions')
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error checking expired subscriptions:', error)
    return { success: false, error }
  }
}

/**
 * Format price from pennies to display string
 * @param {number} pennies - Price in pennies
 * @returns {string} Formatted price string
 */
export function formatPrice(pennies) {
  return `£${(pennies / 100).toFixed(2)}`
}

/**
 * Get days until subscription expires
 * @param {string} endDate - Subscription end date
 * @returns {number} Days remaining (negative if expired)
 */
export function getDaysRemaining(endDate) {
  if (!endDate) return 0
  
  const end = new Date(endDate)
  const now = new Date()
  const diffTime = end - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays
}