'use client'

import { useState, useRef, useEffect } from 'react'
import { HelpCircle, X } from 'lucide-react'

/**
 * HelpIcon Component
 * 
 * A reusable help icon that shows contextual information
 * Can be placed anywhere in the app to provide instant help
 * 
 * @param {string} title - The title of the help content
 * @param {string} content - The help text to display
 * @param {string} position - Tooltip position: 'top', 'bottom', 'left', 'right' (default: 'top')
 * @param {boolean} modal - If true, shows in a modal instead of tooltip
 * @param {string} size - Icon size: 'sm', 'md', 'lg' (default: 'sm')
 * @param {array} bullets - Optional array of bullet points
 * @param {string} videoUrl - Optional video tutorial URL
 */
export default function HelpIcon({ 
  title, 
  content, 
  position = 'top',
  modal = false,
  size = 'sm',
  bullets = [],
  videoUrl = null,
  className = ''
}) {
  const [showHelp, setShowHelp] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const iconRef = useRef(null)
  const tooltipRef = useRef(null)

  // Icon size classes
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  // Calculate tooltip position
  useEffect(() => {
    if (showHelp && !modal && iconRef.current && tooltipRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      
      let top = 0
      let left = 0

      switch (position) {
        case 'top':
          top = iconRect.top - tooltipRect.height - 8
          left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2)
          break
        case 'bottom':
          top = iconRect.bottom + 8
          left = iconRect.left + (iconRect.width / 2) - (tooltipRect.width / 2)
          break
        case 'left':
          top = iconRect.top + (iconRect.height / 2) - (tooltipRect.height / 2)
          left = iconRect.left - tooltipRect.width - 8
          break
        case 'right':
          top = iconRect.top + (iconRect.height / 2) - (tooltipRect.height / 2)
          left = iconRect.right + 8
          break
      }

      // Keep tooltip within viewport
      const padding = 10
      if (left < padding) left = padding
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding
      }
      if (top < padding) top = iconRect.bottom + 8 // Flip to bottom
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = iconRect.top - tooltipRect.height - 8 // Flip to top
      }

      setTooltipPosition({ top, left })
    }
  }, [showHelp, position, modal])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showHelp && !modal && 
          !iconRef.current?.contains(event.target) && 
          !tooltipRef.current?.contains(event.target)) {
        setShowHelp(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHelp, modal])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && showHelp) {
        setShowHelp(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showHelp])

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setShowHelp(!showHelp)
  }

  return (
    <>
      {/* Help Icon Button */}
      <button
        ref={iconRef}
        onClick={handleClick}
        className={`inline-flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors ${className}`}
        aria-label="Help"
        type="button"
      >
        <HelpCircle className={sizeClasses[size]} />
      </button>

      {/* Tooltip Content */}
      {showHelp && !modal && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] bg-gray-900 text-white rounded-lg shadow-xl p-4 max-w-sm animate-fadeIn"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {/* Arrow */}
          <div 
            className={`absolute w-0 h-0 border-8 border-transparent ${
              position === 'top' ? 'bottom-[-16px] left-1/2 transform -translate-x-1/2 border-t-gray-900' :
              position === 'bottom' ? 'top-[-16px] left-1/2 transform -translate-x-1/2 border-b-gray-900' :
              position === 'left' ? 'right-[-16px] top-1/2 transform -translate-y-1/2 border-l-gray-900' :
              'left-[-16px] top-1/2 transform -translate-y-1/2 border-r-gray-900'
            }`}
          />

          {/* Content */}
          {title && <h4 className="font-semibold mb-2 text-sm">{title}</h4>}
          {content && <p className="text-sm leading-relaxed">{content}</p>}
          
          {bullets.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bullets.map((bullet, index) => (
                <li key={index} className="text-sm flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {videoUrl && (
            <a 
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Watch video tutorial →
            </a>
          )}

          {/* Close button */}
          <button
            onClick={() => setShowHelp(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Modal Content */}
      {showHelp && modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg mx-4 relative">
            {/* Close button */}
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            {title && <h3 className="text-lg font-semibold mb-3 pr-8">{title}</h3>}
            {content && <p className="text-gray-600 leading-relaxed">{content}</p>}
            
            {bullets.length > 0 && (
              <ul className="mt-4 space-y-2">
                {bullets.map((bullet, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-blue-600 mr-2 mt-1">•</span>
                    <span className="text-gray-600">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {videoUrl && (
              <div className="mt-4 pt-4 border-t">
                <a 
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  Watch video tutorial →
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </>
  )
}