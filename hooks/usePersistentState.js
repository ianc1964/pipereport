'use client'
import { useState, useEffect, useRef } from 'react'

/**
 * Hook that persists state to sessionStorage and survives tab switches
 * Enhanced to prevent null overwrites and auth-related resets
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if nothing in storage
 * @returns {[any, function]} - [value, setValue] similar to useState
 */
export const usePersistentState = (key, defaultValue) => {
  const [state, setState] = useState(defaultValue)
  const initializedRef = useRef(false)
  const lastValidValueRef = useRef(defaultValue)
  const skipNextSaveRef = useRef(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const stored = sessionStorage.getItem(key)
      if (stored !== null) {
        const parsedValue = JSON.parse(stored)
        setState(parsedValue)
        lastValidValueRef.current = parsedValue
        console.log(`📱 Restored ${key} from session:`, parsedValue)
      } else {
        console.log(`📱 No stored value for ${key}, using default:`, defaultValue)
      }
    } catch (error) {
      console.warn(`Failed to restore ${key} from sessionStorage:`, error)
    }
    
    initializedRef.current = true
  }, [key, defaultValue])

  // Enhanced setState wrapper that prevents unwanted null saves
  const setStateWrapper = (newValue) => {
    let valueToSet
    
    if (typeof newValue === 'function') {
      valueToSet = newValue(state)
    } else {
      valueToSet = newValue
    }
    
    console.log(`🎯 Setting ${key}:`, { 
      current: state, 
      new: valueToSet, 
      lastValid: lastValidValueRef.current 
    })
    
    // PROTECTION: Don't overwrite a valid value with null unless explicitly intended
    if (valueToSet === null && lastValidValueRef.current !== null && lastValidValueRef.current !== defaultValue) {
      console.warn(`⚠️ Prevented ${key} null overwrite of valid value:`, lastValidValueRef.current)
      
      // Check if we have a recent valid value in session storage
      try {
        const stored = sessionStorage.getItem(key)
        if (stored !== null) {
          const parsedValue = JSON.parse(stored)
          if (parsedValue !== null) {
            console.log(`🔄 Restoring ${key} from session instead of null:`, parsedValue)
            setState(parsedValue)
            return
          }
        }
      } catch (error) {
        console.warn(`Failed to check session storage for ${key}:`, error)
      }
    }
    
    setState(valueToSet)
    
    // Update last valid value if this is not null
    if (valueToSet !== null) {
      lastValidValueRef.current = valueToSet
    }
  }

  // Save to sessionStorage when state changes (but not on initial load or null overwrites)
  useEffect(() => {
    if (!initializedRef.current || typeof window === 'undefined') return
    
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      console.log(`⏭️ Skipped saving ${key} (protection active)`)
      return
    }
    
    // Don't save null values if we have a valid previous value (protection against auth resets)
    if (state === null && lastValidValueRef.current !== null && lastValidValueRef.current !== defaultValue) {
      console.warn(`🛡️ Blocked saving null value for ${key}, keeping session value:`, lastValidValueRef.current)
      return
    }
    
    try {
      sessionStorage.setItem(key, JSON.stringify(state))
      console.log(`💾 Saved ${key} to session:`, state)
    } catch (error) {
      console.warn(`Failed to save ${key} to sessionStorage:`, error)
    }
  }, [key, state])

  return [state, setStateWrapper]
}

/**
 * Hook to detect when user switches tabs and returns
 * @param {function} onReturn - Callback when user returns to tab
 * @param {function} onLeave - Callback when user leaves tab
 */
export const useTabVisibility = (onReturn, onLeave) => {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🔄 Tab hidden')
        onLeave?.()
      } else {
        console.log('👁️ Tab visible')
        onReturn?.()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [onReturn, onLeave])
}