'use server'

// /lib/actions/fingerprint-tracking.js
// Server actions for device fingerprint tracking and validation

import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

// Create a Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Check if a device fingerprint has been used for a trial before
 * This should be called BEFORE allowing signup
 */
export async function checkFingerprintForTrial(fingerprintHash) {
  try {
    // Call the database function to check for trial abuse
    const { data, error } = await supabaseAdmin.rpc('check_fingerprint_trial_abuse', {
      p_fingerprint_hash: fingerprintHash
    })

    if (error) {
      console.error('Error checking fingerprint:', error)
      return {
        success: false,
        error: error.message,
        canProceed: true // Allow signup on error to avoid blocking legitimate users
      }
    }

    // Determine if signup should be allowed
    const canProceed = !data[0].is_blocked && data[0].trial_count < 1

    return {
      success: true,
      canProceed,
      isBlocked: data[0].is_blocked,
      trialCount: data[0].trial_count,
      riskLevel: data[0].risk_level,
      message: data[0].message,
      existingCompanies: data[0].companies || []
    }
  } catch (error) {
    console.error('Error in checkFingerprintForTrial:', error)
    return {
      success: false,
      error: error.message,
      canProceed: true // Allow signup on error
    }
  }
}

/**
 * Record a device fingerprint after successful signup/login
 */
export async function recordFingerprint(params) {
  const {
    fingerprintHash,
    fingerprintData,
    confidence,
    userId,
    companyId,
    loginType = 'login'
  } = params

  try {
    // Get IP address from headers
    const headersList = headers()
    const ipAddress = 
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      '127.0.0.1'
    
    const userAgent = headersList.get('user-agent') || null

    // Record the fingerprint in the database
    const { data, error } = await supabaseAdmin.rpc('record_device_fingerprint', {
      p_fingerprint_hash: fingerprintHash,
      p_fingerprint_data: fingerprintData,
      p_confidence_score: confidence,
      p_user_id: userId,
      p_company_id: companyId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_login_type: loginType
    })

    if (error) {
      console.error('Error recording fingerprint:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      fingerprintId: data,
      ipAddress
    }
  } catch (error) {
    console.error('Error in recordFingerprint:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get fingerprint history for a specific company
 */
export async function getCompanyFingerprints(companyId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('fingerprint_users')
      .select(`
        *,
        device_fingerprints!fingerprint_id (
          fingerprint_hash,
          confidence_score,
          first_seen_at,
          last_seen_at,
          seen_count
        ),
        profiles!user_id (
          email,
          full_name
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Group by fingerprint
    const fingerprintsMap = new Map()
    data.forEach(record => {
      const fingerprintId = record.fingerprint_id
      if (!fingerprintsMap.has(fingerprintId)) {
        fingerprintsMap.set(fingerprintId, {
          ...record.device_fingerprints,
          fingerprint_id: fingerprintId,
          users: [],
          ip_addresses: new Set(),
          first_seen: record.created_at,
          last_seen: record.created_at
        })
      }
      
      const fingerprint = fingerprintsMap.get(fingerprintId)
      
      // Add unique users
      if (!fingerprint.users.some(u => u.user_id === record.user_id)) {
        fingerprint.users.push({
          user_id: record.user_id,
          email: record.profiles?.email,
          full_name: record.profiles?.full_name
        })
      }
      
      // Add IP addresses
      if (record.ip_address) {
        fingerprint.ip_addresses.add(record.ip_address)
      }
      
      // Update timestamps
      if (new Date(record.created_at) < new Date(fingerprint.first_seen)) {
        fingerprint.first_seen = record.created_at
      }
      if (new Date(record.created_at) > new Date(fingerprint.last_seen)) {
        fingerprint.last_seen = record.created_at
      }
    })

    // Convert Sets to Arrays for JSON serialization
    const fingerprints = Array.from(fingerprintsMap.values()).map(fp => ({
      ...fp,
      ip_addresses: Array.from(fp.ip_addresses)
    }))

    return { success: true, data: fingerprints }
  } catch (error) {
    console.error('Error fetching company fingerprints:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Get suspicious fingerprints across the system
 */
export async function getSuspiciousFingerprints(minCompanies = 2) {
  try {
    const { data, error } = await supabaseAdmin
      .from('suspicious_fingerprints')
      .select('*')
      .gte('unique_companies', minCompanies)
      .order('trial_companies', { ascending: false })
      .limit(100)

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Error fetching suspicious fingerprints:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Get all companies associated with a specific fingerprint
 */
export async function getCompaniesByFingerprint(fingerprintHash) {
  try {
    // First get the fingerprint ID
    const { data: fingerprintData, error: fingerprintError } = await supabaseAdmin
      .from('device_fingerprints')
      .select('id')
      .eq('fingerprint_hash', fingerprintHash)
      .single()

    if (fingerprintError) throw fingerprintError
    if (!fingerprintData) {
      return { success: true, data: [] }
    }

    // Get all companies associated with this fingerprint
    const { data, error } = await supabaseAdmin
      .from('fingerprint_users')
      .select(`
        company_id,
        is_trial_account,
        created_at,
        ip_address,
        companies!company_id (
          id,
          name,
          email,
          subscription_status,
          created_at
        ),
        profiles!user_id (
          id,
          email,
          full_name,
          role
        )
      `)
      .eq('fingerprint_id', fingerprintData.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Group by company
    const companiesMap = new Map()
    data.forEach(record => {
      if (record.companies) {
        const companyId = record.companies.id
        if (!companiesMap.has(companyId)) {
          companiesMap.set(companyId, {
            ...record.companies,
            users: [],
            ip_addresses: new Set(),
            first_login: record.created_at,
            last_login: record.created_at,
            is_trial: record.is_trial_account
          })
        }
        
        const company = companiesMap.get(companyId)
        company.last_login = record.created_at
        
        // Add unique users
        if (!company.users.some(u => u.id === record.profiles?.id)) {
          company.users.push(record.profiles)
        }
        
        // Add IP addresses
        if (record.ip_address) {
          company.ip_addresses.add(record.ip_address)
        }
      }
    })

    // Convert Sets to Arrays
    const companies = Array.from(companiesMap.values()).map(company => ({
      ...company,
      ip_addresses: Array.from(company.ip_addresses)
    }))

    return { success: true, data: companies }
  } catch (error) {
    console.error('Error fetching companies by fingerprint:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Block a fingerprint from creating new trial accounts
 */
export async function blockFingerprint(fingerprintHash, blockedBy, reason) {
  try {
    // Get fingerprint ID
    const { data: fingerprintData, error: fingerprintError } = await supabaseAdmin
      .from('device_fingerprints')
      .select('id')
      .eq('fingerprint_hash', fingerprintHash)
      .single()

    if (fingerprintError) throw fingerprintError
    if (!fingerprintData) {
      throw new Error('Fingerprint not found')
    }

    // Create or update abuse detection record
    const { error } = await supabaseAdmin
      .from('trial_abuse_detections')
      .insert({
        fingerprint_id: fingerprintData.id,
        detection_type: 'multiple_trials',
        severity: 'critical',
        blocked: true,
        blocked_at: new Date().toISOString(),
        blocked_by: blockedBy,
        notes: reason,
        details: {
          manual_block: true,
          reason: reason
        }
      })

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error blocking fingerprint:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Unblock a fingerprint
 */
export async function unblockFingerprint(fingerprintHash, unblockedBy, reason) {
  try {
    // Get fingerprint ID
    const { data: fingerprintData, error: fingerprintError } = await supabaseAdmin
      .from('device_fingerprints')
      .select('id')
      .eq('fingerprint_hash', fingerprintHash)
      .single()

    if (fingerprintError) throw fingerprintError
    if (!fingerprintData) {
      throw new Error('Fingerprint not found')
    }

    // Update abuse detection records
    const { error } = await supabaseAdmin
      .from('trial_abuse_detections')
      .update({
        blocked: false,
        reviewed: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: unblockedBy,
        notes: reason
      })
      .eq('fingerprint_id', fingerprintData.id)
      .eq('blocked', true)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error unblocking fingerprint:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get trial abuse detections
 */
export async function getTrialAbuseDetections(includeReviewed = false) {
  try {
    let query = supabaseAdmin
      .from('trial_abuse_detections')
      .select(`
        *,
        device_fingerprints!fingerprint_id (
          fingerprint_hash,
          confidence_score,
          first_seen_at,
          last_seen_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!includeReviewed) {
      query = query.eq('reviewed', false)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    console.error('Error fetching trial abuse detections:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Analyze fingerprint patterns for a specific time period
 */
export async function analyzeFingerprintPatterns(days = 30) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get statistics
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('fingerprint_users')
      .select('fingerprint_id, company_id, is_trial_account')
      .gte('created_at', startDate.toISOString())

    if (statsError) throw statsError

    // Calculate metrics
    const fingerprintSet = new Set()
    const companySet = new Set()
    const trialCompanies = new Set()
    const fingerprintCompanyMap = new Map()

    stats.forEach(record => {
      fingerprintSet.add(record.fingerprint_id)
      companySet.add(record.company_id)
      
      if (record.is_trial_account) {
        trialCompanies.add(record.company_id)
      }

      // Track companies per fingerprint
      if (!fingerprintCompanyMap.has(record.fingerprint_id)) {
        fingerprintCompanyMap.set(record.fingerprint_id, new Set())
      }
      fingerprintCompanyMap.get(record.fingerprint_id).add(record.company_id)
    })

    // Calculate suspicious fingerprints (multiple companies)
    let suspiciousCount = 0
    let criticalCount = 0
    
    fingerprintCompanyMap.forEach((companies, fingerprintId) => {
      if (companies.size > 1) {
        suspiciousCount++
      }
      if (companies.size >= 3) {
        criticalCount++
      }
    })

    return {
      success: true,
      data: {
        period_days: days,
        total_fingerprints: fingerprintSet.size,
        total_companies: companySet.size,
        trial_companies: trialCompanies.size,
        suspicious_fingerprints: suspiciousCount,
        critical_fingerprints: criticalCount,
        average_companies_per_fingerprint: (companySet.size / fingerprintSet.size).toFixed(2)
      }
    }
  } catch (error) {
    console.error('Error analyzing fingerprint patterns:', error)
    return { success: false, error: error.message }
  }
}