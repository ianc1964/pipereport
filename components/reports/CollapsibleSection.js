// components/reports/CollapsibleSection.js
'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'

export default function CollapsibleSection({ 
  title, 
  content, 
  isExpanded, 
  onToggle,
  className = '',
  printExpanded = true // Force expansion when printing
}) {
  if (!content) return null

  return (
    <section className={`bg-white rounded-lg shadow-sm p-6 mb-6 ${className}`}>
      <div className="space-y-4">
        {/* Interactive header for screen - hidden when printing */}
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-left hover:bg-gray-50 -mx-2 -my-1 px-2 py-1 rounded transition-colors no-print"
        >
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center text-sm text-gray-500">
            <span className="mr-2">{isExpanded ? 'Hide' : 'Show'}</span>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </div>
        </button>
        
        {/* Static title for print version */}
        <h2 className="text-xl font-semibold text-gray-900 hidden print:block">{title}</h2>
        
        {/* Content with proper screen/print visibility */}
        <div className={`prose max-w-none mt-4 pl-2 ${isExpanded ? 'block' : 'hidden'} ${printExpanded ? 'print:block' : 'print:hidden'}`}>
          <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
            {content}
          </div>
        </div>
      </div>
    </section>
  )
}