// /lib/utils/data-loading.js

import { supabase } from '@/lib/supabase'

/**
 * Retry a Supabase query with exponential backoff
 * Helps with RLS policy issues and network problems
 */
export async function retryQuery(queryFn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => {
      // Retry on RLS errors, timeouts, and network errors
      const retryableErrors = [
        'PGRST301', // RLS policy violation (might be timing issue)
        'PGRST504', // Gateway timeout
        '42P17',    // Infinite recursion in RLS
        'network',  // Network error
        'timeout'   // Timeout error
      ]
      
      const errorMessage = error?.message?.toLowerCase() || ''
      const errorCode = error?.code || ''
      
      return retryableErrors.some(code => 
        errorCode.includes(code) || errorMessage.includes(code.toLowerCase())
      )
    },
    onRetry = (attempt, error) => {
      console.log(`Retry attempt ${attempt}:`, error?.message)
    }
  } = options

  let lastError
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await queryFn()
      
      // Check for Supabase error
      if (result?.error) {
        throw result.error
      }
      
      return result
    } catch (error) {
      lastError = error
      
      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(error)) {
        onRetry(attempt, error)
        
        // Calculate delay with exponential backoff
        const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
  
  throw lastError
}

/**
 * Load data with proper auth checking and retry logic
 */
export async function loadDataWithAuth(loadFn, options = {}) {
  const {
    requireAuth = true,
    retryOptions = {},
    onAuthError = () => {}
  } = options

  if (requireAuth) {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('User not authenticated')
      onAuthError()
      return { data: null, error: new Error('Authentication required') }
    }
  }

  return retryQuery(loadFn, retryOptions)
}

/**
 * Wait for auth to be ready before loading data
 * Useful for pages that load immediately
 */
export async function waitForAuth(timeout = 10000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // Give a small delay to ensure auth context is fully loaded
      await new Promise(resolve => setTimeout(resolve, 500))
      return true
    }
    
    // Check every 100ms
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return false
}

/**
 * Enhanced project loading with retry and auth handling
 */
export async function loadProjectWithRetry(projectId, includeRelations = true) {
  return loadDataWithAuth(
    async () => {
      let query = supabase
        .from('projects')
        .select(includeRelations ? `
          *,
          sections (
            id,
            name,
            start_node,
            end_node,
            video_url,
            video_filename,
            video_duration,
            is_locked,
            order_index
          ),
          observations (
            id,
            section_id,
            observation_code,
            observation_type,
            position,
            severity,
            description,
            image_url,
            image_key,
            quantity_unit,
            action,
            created_at,
            profiles (
              full_name
            )
          ),
          companies (
            id,
            name
          ),
          profiles (
            id,
            full_name,
            email
          )
        ` : '*')
        .eq('id', projectId)
        .single()

      return await query
    },
    {
      retryOptions: {
        maxRetries: 3,
        onRetry: (attempt, error) => {
          console.log(`Retrying project load (attempt ${attempt}):`, error?.message)
        }
      }
    }
  )
}

/**
 * Load observation codes with retry
 */
export async function loadObservationCodesWithRetry() {
  return retryQuery(
    async () => {
      return await supabase
        .from('observation_codes')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
    },
    {
      maxRetries: 3,
      onRetry: (attempt) => {
        console.log(`Retrying observation codes load (attempt ${attempt})`)
      }
    }
  )
}

/**
 * Batch load multiple related entities with retry
 */
export async function batchLoadWithRetry(queries) {
  const results = await Promise.allSettled(
    queries.map(query => retryQuery(query))
  )
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return { success: true, data: result.value.data, error: null }
    } else {
      console.error(`Query ${index} failed:`, result.reason)
      return { success: false, data: null, error: result.reason }
    }
  })
}

/**
 * Create a debounced loader to prevent rapid repeated loads
 */
export function createDebouncedLoader(loadFn, delay = 500) {
  let timeoutId = null
  let lastCallTime = 0
  
  return (...args) => {
    const now = Date.now()
    
    // If called very recently, debounce
    if (now - lastCallTime < delay) {
      if (timeoutId) clearTimeout(timeoutId)
      
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            const result = await loadFn(...args)
            resolve(result)
          } catch (error) {
            reject(error)
          }
        }, delay)
      })
    }
    
    lastCallTime = now
    return loadFn(...args)
  }
}