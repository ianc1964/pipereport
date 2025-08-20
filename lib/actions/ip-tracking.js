'use server'

import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// Create a Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Get the client's IP address from request headers
 * Works with various proxy configurations (Vercel, Cloudflare, etc.)
 */
export async function getClientIP() {
  const headersList = headers()
  
  // Check various headers in order of preference
  const forwardedFor = headersList.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }
  
  // Vercel-specific header
  const realIP = headersList.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  // Cloudflare-specific header
  const cfConnectingIP = headersList.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // Standard forwarded header
  const forwarded = headersList.get('forwarded')
  if (forwarded) {
    const match = forwarded.match(/for=([^;,]+)/)
    if (match) {
      return match[1].replace(/['"]/g, '')
    }
  }
  
  // Fallback to localhost if no IP found (development)
  return '127.0.0.1'
}

/**
 * Track a login event with IP address
 */
export async function trackLogin(userId, loginType = 'login') {
  try {
    const ip = await getClientIP()
    const headersList = headers()
    const userAgent = headersList.get('user-agent') || null
    
    // Call the database function to track the login
    const { error } = await supabaseAdmin.rpc('track_login_activity', {
      p_user_id: userId,
      p_ip_address: ip,
      p_user_agent: userAgent,
      p_login_type: loginType
    })
    
    if (error) {
      console.error('Error tracking login:', error)
      return { success: false, error: error.message }
    }
    
    return { success: true, ip }
  } catch (error) {
    console.error('Error in trackLogin:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get login history for a specific company
 */
export async function getCompanyLoginHistory(companyId, limit = 50) {
  try {
    const { data, error } = await supabaseAdmin
      .from('login_history')
      .select(`
        *,
        profiles!user_id (
          email,
          full_name
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching login history:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Get suspicious IP patterns across all companies
 */
export async function getSuspiciousIPs() {
  try {
    const { data, error } = await supabaseAdmin
      .from('suspicious_ip_patterns')
      .select('*')
      .limit(100)
    
    if (error) throw error
    
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching suspicious IPs:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Get all companies associated with a specific IP address
 */
export async function getCompaniesByIP(ipAddress) {
  try {
    const { data, error } = await supabaseAdmin
      .from('login_history')
      .select(`
        company_id,
        companies!company_id (
          id,
          name,
          email,
          subscription_status,
          created_at
        ),
        profiles!user_id (
          email,
          full_name,
          role
        ),
        created_at
      `)
      .eq('ip_address', ipAddress)
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
            first_login: record.created_at,
            last_login: record.created_at,
            login_count: 0
          })
        }
        const company = companiesMap.get(companyId)
        company.login_count++
        company.last_login = record.created_at
        
        // Add unique users
        const userEmail = record.profiles?.email
        if (userEmail && !company.users.some(u => u.email === userEmail)) {
          company.users.push(record.profiles)
        }
      }
    })
    
    return { 
      success: true, 
      data: Array.from(companiesMap.values()) 
    }
  } catch (error) {
    console.error('Error fetching companies by IP:', error)
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Check if an IP address has been used by multiple trial accounts
 */
export async function checkIPForTrialAbuse(ipAddress) {
  try {
    const { data, error } = await supabaseAdmin
      .from('login_history')
      .select(`
        company_id,
        companies!company_id (
          id,
          name,
          subscription_status,
          created_at
        )
      `)
      .eq('ip_address', ipAddress)
      .eq('companies.subscription_status', 'trial')
    
    if (error) throw error
    
    // Count unique trial companies from this IP
    const uniqueTrialCompanies = new Set()
    data.forEach(record => {
      if (record.companies) {
        uniqueTrialCompanies.add(record.companies.id)
      }
    })
    
    return {
      success: true,
      isAbusive: uniqueTrialCompanies.size > 1,
      trialCount: uniqueTrialCompanies.size,
      companies: Array.from(uniqueTrialCompanies).map(id => 
        data.find(d => d.companies?.id === id)?.companies
      )
    }
  } catch (error) {
    console.error('Error checking IP for trial abuse:', error)
    return { success: false, error: error.message }
  }
}