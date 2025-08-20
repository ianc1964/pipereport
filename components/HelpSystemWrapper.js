'use client'

import { useState, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'
import HelpPanel from './help/HelpPanel'

/**
 * HelpSystemWrapper Component
 * 
 * Save this file as: /components/HelpSystemWrapper.js
 * 
 * This wrapper adds the help system to your application
 * It provides the floating help button and keyboard shortcut
 */
export default function HelpSystemWrapper({ children }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [showHelpButton, setShowHelpButton] = useState(true)
  const pathname = usePathname()

  // Hide help button on auth pages
  useEffect(() => {
    if (pathname?.startsWith('/auth/')) {
      setShowHelpButton(false)
      setHelpOpen(false)
    } else {
      setShowHelpButton(true)
    }
  }, [pathname])

  // Keyboard shortcut for help (? key)
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Check if user pressed '?' key (Shift + /)
      if (event.key === '?' && !event.target.matches('input, textarea, select')) {
        event.preventDefault()
        setHelpOpen(prev => !prev)
      }
      // Close on Escape
      if (event.key === 'Escape' && helpOpen) {
        setHelpOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [helpOpen])

  return (
    <>
      {children}
      
      {/* Floating Help Button */}
      {showHelpButton && (
        <button
          onClick={() => setHelpOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg z-50 transition-all hover:scale-110 group"
          aria-label="Help & Support"
          title="Help & Support (Press ? key)"
        >
          <HelpCircle className="w-6 h-6" />
          
          {/* Tooltip on hover */}
          <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Press ? for help
          </span>
        </button>
      )}
      
      {/* Help Panel */}
      <HelpPanel isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  )
}