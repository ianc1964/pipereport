// components/reports/FindingsTab.js
// Findings review tab showing captured observations organized by section

import { useState } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle,
  MapPin,
  Camera,
  Film,
  Info,
  Search,
  Filter
} from 'lucide-react'

export default function FindingsTab({ report, isReadOnly }) {
  const sections = report.sections_snapshot || []
  const observations = report.observations_snapshot || []
  
  const [expandedSections, setExpandedSections] = useState(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [showOnlyWithMedia, setShowOnlyWithMedia] = useState(false)
  
  // Group observations by section
  const observationsBySection = {}
  observations.forEach(obs => {
    if (!observationsBySection[obs.section_id]) {
      observationsBySection[obs.section_id] = []
    }
    observationsBySection[obs.section_id].push(obs)
  })
  
  // Apply filters
  const filterObservations = (sectionObs) => {
    return sectionObs.filter(obs => {
      // Search filter
      if (searchTerm && !obs.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !obs.description?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !obs.code?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      
      // Severity filter
      if (severityFilter !== 'all' && obs.severity !== parseInt(severityFilter)) {
        return false
      }
      
      // Media filter
      if (showOnlyWithMedia && !obs.image_url && !obs.video_ref) {
        return false
      }
      
      return true
    })
  }
  
  const toggleSection = (sectionId) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }
  
  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)))
  }
  
  const collapseAll = () => {
    setExpandedSections(new Set())
  }
  
  const getSeverityBadge = (severity) => {
    const severityConfig = {
      5: { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical' },
      4: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'High' },
      3: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Medium' },
      2: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Low' },
      1: { bg: 'bg-green-100', text: 'text-green-800', label: 'Minor' }
    }
    
    const config = severityConfig[severity] || severityConfig[1]
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    )
  }
  
  // Calculate total filtered observations
  let totalFilteredObs = 0
  sections.forEach(section => {
    const sectionObs = observationsBySection[section.id] || []
    totalFilteredObs += filterObservations(sectionObs).length
  })

  return (
    <div className="p-6">
      {/* Header and Filters */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Inspection Findings Review</h3>
          <div className="flex space-x-2">
            <button
              onClick={expandAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Expand All
            </button>
            <span className="text-gray-400">|</span>
            <button
              onClick={collapseAll}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Collapse All
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search className="inline h-4 w-4 mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search observations..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="inline h-4 w-4 mr-1" />
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="5">Critical</option>
              <option value="4">High</option>
              <option value="3">Medium</option>
              <option value="2">Low</option>
              <option value="1">Minor</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showOnlyWithMedia}
                onChange={(e) => setShowOnlyWithMedia(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Only show observations with media</span>
            </label>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          Showing {totalFilteredObs} of {observations.length} observations across {sections.length} sections
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {sections.map((section) => {
          const sectionObs = observationsBySection[section.id] || []
          const filteredObs = filterObservations(sectionObs)
          const isExpanded = expandedSections.has(section.id)
          
          // Calculate section stats
          const criticalCount = sectionObs.filter(o => o.severity >= 4).length
          
          return (
            <div key={section.id} className="bg-white border rounded-lg shadow-sm">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-gray-400 mr-2" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400 mr-2" />
                  )}
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900">
                      Section {section.section_number}: {section.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {section.start_ref} to {section.finish_ref} • 
                      {filteredObs.length} observation{filteredObs.length !== 1 ? 's' : ''}
                      {criticalCount > 0 && (
                        <span className="text-red-600 ml-2">
                          ({criticalCount} critical)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {section.video_url && (
                    <Film className="h-4 w-4 text-gray-400" title="Has video" />
                  )}
                  <span className="text-sm text-gray-500">
                    {section.diameter || 'Unknown'} • {section.material || 'Unknown'}
                  </span>
                </div>
              </button>
              
              {/* Section Observations */}
              {isExpanded && (
                <div className="border-t">
                  {filteredObs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      {sectionObs.length === 0 ? 'No observations in this section' : 'No observations match the current filters'}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredObs.sort((a, b) => a.distance - b.distance).map((obs) => (
                        <div key={obs.id} className="px-4 py-3 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center mb-1">
                                <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                                <span className="text-sm font-medium text-gray-900">
                                  {obs.distance?.toFixed(2)}m
                                </span>
                                <span className="mx-2 text-gray-400">•</span>
                                <span className="text-sm text-gray-600">
                                  {obs.code}
                                </span>
                                <span className="ml-2">
                                  {getSeverityBadge(obs.severity)}
                                </span>
                              </div>
                              
                              <p className="text-sm text-gray-700 mb-1">
                                {obs.name || obs.description || 'No description'}
                              </p>
                              
                              {obs.remarks && (
                                <p className="text-sm text-gray-500 italic">
                                  Remarks: {obs.remarks}
                                </p>
                              )}
                              
                              <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                                {obs.clock_ref_1 && (
                                  <span>Clock: {obs.clock_ref_1}{obs.clock_ref_2 ? ` - ${obs.clock_ref_2}` : ''}</span>
                                )}
                                {obs.dimension_1 && (
                                  <span>Size: {obs.dimension_1}mm{obs.dimension_2 ? ` x ${obs.dimension_2}mm` : ''}</span>
                                )}
                                {obs.loss_percentage && (
                                  <span>Loss: {obs.loss_percentage}%</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center ml-4 space-x-2">
                              {obs.image_url && (
                                <a
                                  href={obs.image_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                  title="View image"
                                >
                                  <Camera className="h-5 w-5" />
                                </a>
                              )}
                              {obs.video_ref && (
                                <span className="text-gray-400" title={`Video at ${obs.video_timestamp}s`}>
                                  <Film className="h-5 w-5" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {sections.length === 0 && (
        <div className="text-center py-12">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No sections found in this report</p>
        </div>
      )}
    </div>
  )
}