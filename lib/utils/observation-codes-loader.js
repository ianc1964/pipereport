// /lib/utils/observation-codes-loader.js

import { supabase } from '@/lib/supabase'

// Cache for observation codes to reduce repeated loads
let codesCache = null
let cacheTimestamp = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Load observation codes with retry logic and caching
 */
export async function loadObservationCodes(forceRefresh = false) {
  // Check cache first
  if (!forceRefresh && codesCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    console.log('Using cached observation codes')
    return codesCache
  }

  let lastError = null
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Loading observation codes (attempt ${attempt}/${maxRetries})...`)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      )
      
      const queryPromise = supabase
        .from('observation_codes')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise])
      
      if (error) {
        // Check for specific error types
        if (error.code === 'PGRST301' || error.message?.includes('policy')) {
          console.log('RLS policy error, waiting before retry...')
          await new Promise(resolve => setTimeout(resolve, 2000))
          throw error
        }
        throw error
      }
      
      if (!data || data.length === 0) {
        console.warn('No observation codes found, using defaults')
        // Return default codes if none found
        return getDefaultObservationCodes()
      }
      
      // Cache the successful result
      codesCache = data
      cacheTimestamp = Date.now()
      
      console.log(`Successfully loaded ${data.length} observation codes`)
      return data
      
    } catch (error) {
      lastError = error
      console.error(`Attempt ${attempt} failed:`, error.message)
      
      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        console.log(`Waiting ${delay}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // All retries failed, return defaults
  console.error('All attempts to load observation codes failed, using defaults:', lastError)
  return getDefaultObservationCodes()
}

/**
 * Get default observation codes as fallback
 */
function getDefaultObservationCodes() {
  return [
    {
      id: 'default-1',
      code: 'DEFECT',
      name: 'General Defect',
      category: 'Structural',
      severity_levels: [1, 2, 3, 4, 5],
      requires_image: false,
      requires_quantity: false,
      is_active: true,
      display_order: 1
    },
    {
      id: 'default-2',
      code: 'CRACK',
      name: 'Crack',
      category: 'Structural',
      severity_levels: [1, 2, 3, 4, 5],
      requires_image: true,
      requires_quantity: false,
      is_active: true,
      display_order: 2
    },
    {
      id: 'default-3',
      code: 'BLOCK',
      name: 'Blockage',
      category: 'Operational',
      severity_levels: [1, 2, 3, 4, 5],
      requires_image: false,
      requires_quantity: false,
      is_active: true,
      display_order: 3
    },
    {
      id: 'default-4',
      code: 'LEAK',
      name: 'Leak/Infiltration',
      category: 'Operational',
      severity_levels: [1, 2, 3, 4, 5],
      requires_image: true,
      requires_quantity: false,
      is_active: true,
      display_order: 4
    },
    {
      id: 'default-5',
      code: 'ROOT',
      name: 'Root Intrusion',
      category: 'Environmental',
      severity_levels: [1, 2, 3, 4, 5],
      requires_image: true,
      requires_quantity: false,
      is_active: true,
      display_order: 5
    }
  ]
}

/**
 * Clear the cache (useful after adding/editing codes)
 */
export function clearObservationCodesCache() {
  codesCache = null
  cacheTimestamp = null
}

/**
 * Hook for React components to load observation codes
 */
export function useObservationCodes() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadingRef = useRef(false)
  
  useEffect(() => {
    const loadCodes = async () => {
      // Prevent duplicate loads
      if (loadingRef.current) return
      loadingRef.current = true
      
      try {
        setLoading(true)
        setError(null)
        const loadedCodes = await loadObservationCodes()
        setCodes(loadedCodes)
      } catch (err) {
        console.error('Failed to load observation codes:', err)
        setError(err.message)
        // Still set default codes on error
        setCodes(getDefaultObservationCodes())
      } finally {
        setLoading(false)
        loadingRef.current = false
      }
    }
    
    loadCodes()
  }, [])
  
  const reload = async () => {
    clearObservationCodesCache()
    loadingRef.current = false
    await loadCodes()
  }
  
  return { codes, loading, error, reload }
}