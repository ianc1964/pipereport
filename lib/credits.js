import { supabase } from './supabase'

/**
 * Check if a company has sufficient credits for an operation
 * @param {string} companyId - The company ID
 * @param {number} requiredCredits - Number of credits required
 * @returns {Promise<boolean>} - Whether the company has enough credits
 */
export async function checkCredits(companyId, requiredCredits) {
  if (!companyId) return false
  
  const { data, error } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('company_id', companyId)
    .single()
  
  if (error) {
    console.error('Error checking credits:', error)
    return false
  }
  
  return data?.balance >= requiredCredits
}

/**
 * Consume credits for a specific operation
 * @param {string} companyId - The company ID
 * @param {string} userId - The user ID performing the operation
 * @param {number} amount - Number of credits to consume
 * @param {string} operationType - Type of operation (e.g., 'video_upload', 'ai_inference')
 * @param {string} description - Description of the operation
 * @param {object} metadata - Additional metadata
 * @returns {Promise<{success: boolean, newBalance?: number, error?: string}>}
 */
export async function consumeCredits(companyId, userId, amount, operationType, description, metadata = {}) {
  try {
    // Call the database function with existing signature
    const { data, error } = await supabase
      .rpc('consume_credits', {
        p_company_id: companyId,
        p_amount: amount,
        p_description: description,
        p_reference_type: operationType,
        p_reference_id: metadata.referenceId || null,
        p_user_id: userId,
        p_metadata: metadata
      })
    
    if (error) throw error
    
    return { success: true, newBalance: data }
  } catch (error) {
    console.error('Error consuming credits:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to consume credits' 
    }
  }
}

/**
 * Add credits to a company (for purchases or manual adjustments)
 * @param {string} companyId - The company ID
 * @param {string} userId - The user ID performing the addition
 * @param {number} amount - Number of credits to add
 * @param {string} type - Transaction type (e.g., 'purchase', 'manual_adjustment')
 * @param {string} description - Description of the transaction
 * @param {object} metadata - Additional metadata
 * @returns {Promise<{success: boolean, newBalance?: number, error?: string}>}
 */
export async function addCredits(companyId, userId, amount, type = 'manual_adjustment', description, metadata = {}) {
  try {
    // Call the database function with existing signature
    const { data, error } = await supabase
      .rpc('add_credits', {
        p_company_id: companyId,
        p_amount: amount,
        p_description: description,
        p_expires_at: metadata.expiresAt || null,
        p_payment_reference: metadata.paymentReference || `${type}_${Date.now()}`
      })
    
    if (error) throw error
    
    // The database function already creates the transaction record
    // No need to insert separately
    
    return { success: true, newBalance: data }
  } catch (error) {
    console.error('Error adding credits:', error)
    return { 
      success: false, 
      error: error.message || 'Failed to add credits' 
    }
  }
}

/**
 * Get credit balance for a company
 * @param {string} companyId - The company ID
 * @returns {Promise<{balance: number, totalPurchased: number, totalConsumed: number}>}
 */
export async function getCreditBalance(companyId) {
  if (!companyId) return { balance: 0, totalPurchased: 0, totalConsumed: 0 }
  
  const { data, error } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, total_consumed')
    .eq('company_id', companyId)
    .single()
  
  if (error) {
    console.error('Error getting credit balance:', error)
    console.log('Company ID:', companyId)
    return { balance: 0, totalPurchased: 0, totalConsumed: 0 }
  }
  
  console.log('Credit balance data:', data)
  
  return {
    balance: data.balance || 0,
    totalPurchased: data.total_purchased || 0,
    totalConsumed: data.total_consumed || 0
  }
}

/**
 * Get credit transaction history for a company
 * @param {string} companyId - The company ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} - Array of transactions
 */
export async function getCreditTransactions(companyId, options = {}) {
  const { 
    limit = 50, 
    offset = 0, 
    startDate = null, 
    endDate = null,
    type = null 
  } = options
  
  let query = supabase
    .from('credit_transactions')
    .select(`
      *,
      profiles!credit_transactions_user_id_fkey(
        full_name,
        email
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  
  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  
  if (endDate) {
    query = query.lte('created_at', endDate)
  }
  
  if (type) {
    query = query.eq('type', type)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error getting credit transactions:', error)
    return []
  }
  
  return data || []
}

/**
 * Get credit pricing rules
 * @returns {Promise<Array>} - Array of pricing rules
 */
export async function getCreditPricingRules() {
  const { data, error } = await supabase
    .from('credit_pricing_rules')
    .select('*')
    .eq('is_active', true)
    .order('operation_type')
  
  if (error) {
    console.error('Error getting pricing rules:', error)
    return []
  }
  
  return data || []
}

/**
 * Get credit consumption statistics for a company
 * @param {string} companyId - The company ID
 * @param {string} period - Time period ('day', 'week', 'month', 'all')
 * @returns {Promise<object>} - Consumption statistics
 */
export async function getCreditConsumptionStats(companyId, period = 'month') {
  let startDate = new Date()
  
  switch (period) {
    case 'day':
      startDate.setDate(startDate.getDate() - 1)
      break
    case 'week':
      startDate.setDate(startDate.getDate() - 7)
      break
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1)
      break
    case 'all':
      startDate = new Date(0) // Beginning of time
      break
  }
  
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('type, amount, created_at')
    .eq('company_id', companyId)
    .eq('type', 'consumption')
    .gte('created_at', startDate.toISOString())
  
  if (error) {
    console.error('Error getting consumption stats:', error)
    return { total: 0, byType: {} }
  }
  
  // Calculate statistics
  const stats = {
    total: 0,
    byType: {},
    dailyAverage: 0
  }
  
  data.forEach(transaction => {
    stats.total += Math.abs(transaction.amount)
    
    const type = transaction.metadata?.operation_type || 'other'
    if (!stats.byType[type]) {
      stats.byType[type] = 0
    }
    stats.byType[type] += Math.abs(transaction.amount)
  })
  
  // Calculate daily average
  const days = period === 'all' ? 30 : (new Date() - startDate) / (1000 * 60 * 60 * 24)
  stats.dailyAverage = Math.round(stats.total / days)
  
  return stats
}

/**
 * Check if user has permission to manage credits
 * @param {object} profile - User profile
 * @param {string} companyId - Company ID to manage
 * @returns {boolean} - Whether user can manage credits
 */
export function canManageCredits(profile, companyId) {
  if (!profile) return false
  
  // Super admins can manage any company's credits
  if (profile.role === 'super_admin') return true
  
  // Company admins can manage their own company's credits
  if (profile.role === 'company_admin' && profile.company_id === companyId) {
    return true
  }
  
  return false
}

/**
 * Format credits display
 * @param {number} credits - Number of credits
 * @returns {string} - Formatted string
 */
export function formatCredits(credits) {
  return new Intl.NumberFormat('en-US').format(credits || 0)
}

/**
 * Get operation display name
 * @param {string} operationType - Operation type key
 * @returns {string} - Human-readable name
 */
export function getOperationDisplayName(operationType) {
  const names = {
    'video_upload': 'Video Upload',
    'image_upload': 'Image Upload',
    'image_capture': 'Frame Capture',
    'frame_extraction': 'Frame Extraction',
    'ai_inference': 'AI Analysis',
    'report_generation': 'Report Generation',
    'manual_adjustment': 'Manual Adjustment',
    'purchase': 'Credit Purchase',
    'trial': 'Trial Credits',
    'expiry': 'Credits Expired'
  }
  
  return names[operationType] || operationType
}

/**
 * Calculate credits required for an operation based on pricing rules
 * @param {string} operationType - Type of operation (e.g., 'video_upload', 'image_upload')
 * @param {object} params - Parameters for calculation
 * @param {number} params.fileSize - File size in bytes (for file-based operations)
 * @param {number} params.duration - Duration in seconds (for time-based operations)
 * @param {number} params.count - Count of operations (default 1)
 * @returns {Promise<{credits: number, rule: object}>} - Credits required and the rule used
 */
export async function calculateCreditsRequired(operationType, params = {}) {
  try {
    // Get active pricing rule for this operation
    const { data: rules, error } = await supabase
      .from('credit_pricing_rules')
      .select('*')
      .eq('operation_type', operationType)
      .eq('is_active', true)
      .single()

    if (error || !rules) {
      console.error('No active pricing rule found for:', operationType)
      // Return default values as fallback
      const defaults = {
        video_upload: 10,
        image_upload: 1,
        image_capture: 1,
        ai_inference: 5
      }
      return { 
        credits: defaults[operationType] || 1, 
        rule: null 
      }
    }

    const rule = rules
    let credits = 0

    // Calculate based on unit type
    switch (rule.unit_type) {
      case 'per_mb':
        // Convert bytes to MB
        const sizeInMB = (params.fileSize || 0) / (1024 * 1024)
        credits = sizeInMB * parseFloat(rule.credits_per_unit)
        break
        
      case 'per_gb':
        // Convert bytes to GB
        const sizeInGB = (params.fileSize || 0) / (1024 * 1024 * 1024)
        credits = sizeInGB * parseFloat(rule.credits_per_unit)
        break
        
      case 'per_minute':
        // Convert seconds to minutes
        const minutes = (params.duration || 0) / 60
        credits = minutes * parseFloat(rule.credits_per_unit)
        break
        
      case 'per_upload':
      case 'per_operation':
      case 'per_inference':
      case 'per_video':
        // Flat rate per operation
        const count = params.count || 1
        credits = count * parseFloat(rule.credits_per_unit)
        break
        
      default:
        console.warn('Unknown unit type:', rule.unit_type)
        credits = parseFloat(rule.credits_per_unit)
    }

    // Apply min/max charges if set
    if (rule.min_charge && credits < parseFloat(rule.min_charge)) {
      credits = parseFloat(rule.min_charge)
    }
    if (rule.max_charge && credits > parseFloat(rule.max_charge)) {
      credits = parseFloat(rule.max_charge)
    }

    // Round to 2 decimal places
    credits = Math.round(credits * 100) / 100

    return { credits, rule }
  } catch (error) {
    console.error('Error calculating credits:', error)
    // Return safe defaults
    const defaults = {
      video_upload: 10,
      image_upload: 1,
      image_capture: 1,
      ai_inference: 5
    }
    return { 
      credits: defaults[operationType] || 1, 
      rule: null 
    }
  }
}