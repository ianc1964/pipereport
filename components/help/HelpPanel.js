'use client'

import { useState, useEffect } from 'react'
import { X, Search, HelpCircle, ChevronRight, Home, Book, Keyboard } from 'lucide-react'
import { getPageHelp, searchHelpContent, getHelpContent } from './help-content'
import { usePathname } from 'next/navigation'

/**
 * HelpPanel Component
 * 
 * A slide-out help panel that provides comprehensive help for the current page
 * Can be toggled from the navigation or floating help button
 */
export default function HelpPanel({ isOpen, onClose }) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeTab, setActiveTab] = useState('context') // 'context', 'search', 'shortcuts'
  
  // Get help content for current page
  const pageHelp = getPageHelp(pathname)

  // Handle search
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchHelpContent(searchQuery)
      setSearchResults(results.slice(0, 10)) // Limit to 10 results
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  // Reset when panel opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setSearchResults([])
      setSelectedItem(null)
      setActiveTab('context')
    }
  }, [isOpen])

  // Keyboard shortcuts
  const shortcuts = [
    { keys: ['Space'], description: 'Play/pause video' },
    { keys: ['←', '→'], description: 'Previous/next frame' },
    { keys: ['↑', '↓'], description: 'Jump 10 seconds' },
    { keys: ['Esc'], description: 'Close modals/dialogs' },
    { keys: ['Ctrl', 'S'], description: 'Save current work' },
    { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
    { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo action' },
    { keys: ['?'], description: 'Open help panel' }
  ]

  // Quick links based on user role
  const quickLinks = [
    { title: 'Getting Started', path: 'general.navigation' },
    { title: 'Creating Projects', path: 'projects.createProject' },
    { title: 'Recording Observations', path: 'projectDetail.observations' },
    { title: 'Understanding Credits', path: 'credits.balance' },
    { title: 'Generating Reports', path: 'reports.generation' },
    { title: 'Keyboard Shortcuts', path: 'general.shortcuts' }
  ]

  const handleItemClick = (item) => {
    if (typeof item === 'string') {
      // It's a path
      const content = getHelpContent(item)
      setSelectedItem({ path: item, ...content })
    } else {
      // It's already a content object
      setSelectedItem(item)
    }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-[9998] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-[9999] transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Help & Support</h2>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-200" />
              <input
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setActiveTab('search')
                }}
                className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur border border-white/30 rounded-lg text-white placeholder-blue-100 focus:outline-none focus:bg-white/30 focus:border-white/50"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b bg-gray-50">
            <button
              onClick={() => setActiveTab('context')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'context' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Home className="w-4 h-4 inline mr-1" />
              This Page
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'search' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </button>
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'shortcuts' 
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Keyboard className="w-4 h-4 inline mr-1" />
              Shortcuts
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Context Tab - Help for current page */}
            {activeTab === 'context' && (
              <div className="p-4 space-y-4">
                {selectedItem ? (
                  // Show selected item details
                  <div className="animate-slideIn">
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-3"
                    >
                      ← Back to list
                    </button>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-lg mb-2">{selectedItem.title}</h3>
                      <p className="text-gray-700 mb-3">{selectedItem.content}</p>
                      {selectedItem.bullets && (
                        <ul className="space-y-2">
                          {selectedItem.bullets.map((bullet, index) => (
                            <li key={index} className="flex items-start">
                              <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                              <span className="text-sm text-gray-600">{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Page-specific help */}
                    {pageHelp.length > 0 ? (
                      <>
                        <div>
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Help for this page
                          </h3>
                          <div className="space-y-2">
                            {pageHelp.map((item, index) => (
                              <button
                                key={index}
                                onClick={() => handleItemClick(item)}
                                className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                              >
                                <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                                <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <HelpCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No specific help available for this page.</p>
                        <p className="text-sm mt-2">Try searching or browse quick links below.</p>
                      </div>
                    )}

                    {/* Quick Links */}
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Quick Links
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {quickLinks.map((link, index) => (
                          <button
                            key={index}
                            onClick={() => handleItemClick(link.path)}
                            className="p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                          >
                            {link.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Search Tab */}
            {activeTab === 'search' && (
              <div className="p-4">
                {searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 mb-3">
                      Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                    </p>
                    {searchResults.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleItemClick(item)}
                        className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{item.content}</p>
                      </button>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No results found for "{searchQuery}"</p>
                    <p className="text-sm mt-2">Try different keywords or browse the help topics.</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Start typing to search help content</p>
                  </div>
                )}
              </div>
            )}

            {/* Shortcuts Tab */}
            {activeTab === 'shortcuts' && (
              <div className="p-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-4">
                    Speed up your workflow with these keyboard shortcuts:
                  </p>
                  {shortcuts.map((shortcut, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-700">{shortcut.description}</span>
                      <div className="flex items-center space-x-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-gray-400 mx-1">+</span>}
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <a 
                href="mailto:support@yourdomain.com"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Contact Support
              </a>
              <button
                onClick={() => window.open('/docs', '_blank')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <Book className="w-4 h-4 mr-1" />
                Documentation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  )
}