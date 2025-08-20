// components/reports/EnhancedDetailedFindings.js
'use client'

import { useState, useRef } from 'react'
import { 
  ChevronDown,
  ChevronUp,
  MapPin,
  ArrowRight,
  Gauge,
  Package,
  Home,
  Play,
  X,
  HelpCircle,
  Eye,
  Info
} from 'lucide-react'
import PipeGraphic from './PipeGraphic'
import { getDefectExplanation } from '@/lib/constants/defectCodes'
import { 
  getSeverityColor,
  getTrafficLightColor,
  getTrafficLightGroup,
  getSectionGrade,
  getTrafficLightCounts
} from '@/lib/utils/severityUtils'

export default function EnhancedDetailedFindings({ sections = [], observations = [] }) {
  const [expandedSections, setExpandedSections] = useState({})
  const [showAllDetails, setShowAllDetails] = useState({})
  const [selectedImage, setSelectedImage] = useState(null)
  const [showExplanations, setShowExplanations] = useState(false)
  const [videoModal, setVideoModal] = useState(null)
  const [highlightedObs, setHighlightedObs] = useState(null)
  const observationRefs = useRef({})

  // Group observations by section
  const observationsBySection = {}
  observations.forEach(obs => {
    if (!observationsBySection[obs.section_id]) {
      observationsBySection[obs.section_id] = []
    }
    observationsBySection[obs.section_id].push(obs)
  })

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const handleObservationClick = (obs, sectionId) => {
    // Ensure section is expanded
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: true
    }))
    
    // Highlight observation
    setHighlightedObs(obs.id)
    
    // Scroll to observation after a brief delay to allow expansion
    setTimeout(() => {
      const obsElement = observationRefs.current[obs.id]
      if (obsElement) {
        obsElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      setHighlightedObs(null)
    }, 3000)
  }

  const handleVideoPlay = (section, timecode) => {
    const adjustedTime = Math.max(0, (timecode || 0) - 2)
    setVideoModal({
      url: section.video_url,
      startTime: adjustedTime,
      sectionName: section.name
    })
  }

  // Helper function to format field names
  const formatFieldName = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  // Helper function to format field values
  const formatFieldValue = (value) => {
    if (value === null || value === undefined) return 'N/A'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'object') return JSON.stringify(value)
    return value.toString()
  }

  // Fields to exclude from detailed display
  const excludedFields = [
    'id', 'project_id', 'video_url', 'video_metadata', 'created_at', 
    'updated_at', 'mux_metadata', 'mux_status', 'cloudflare_status', 
    'cloudflare_metadata', 'name', 'section_number'
  ]

  // Group fields by category for better organization
  const getFieldCategories = (section) => {
    return {
      'Location Information': ['start_ref', 'finish_ref', 'start_type', 'finish_type', 
                              'start_depth', 'finish_depth', 'start_coordinates', 'finish_coordinates'],
      'Technical Specifications': ['direction', 'diameter', 'use_type', 'material', 
                                  'shape', 'section_type', 'lining_type', 'lining_material'],
      'Inspection Details': ['inspection_purpose', 'flow_control', 'precleaned', 
                            'survey_method', 'location_type', 'inspection_date', 
                            'weather', 'location_if_different'],
      'Video Information': ['video_filename', 'video_duration'],
      'Additional Information': ['general_remarks']
    }
  }

  return (
    <div className="space-y-4 print-detailed-findings">
      {/* Help toggle */}
      <div className="flex justify-end mb-2 no-print">
        <button
          onClick={() => setShowExplanations(!showExplanations)}
          className="flex items-center text-sm text-blue-600 hover:text-blue-700"
        >
          <HelpCircle className="w-4 h-4 mr-1" />
          {showExplanations ? 'Hide' : 'Show'} defect explanations
        </button>
      </div>

      {sections.map(section => {
        const sectionObservations = observationsBySection[section.id] || []
        const isExpanded = expandedSections[section.id]
        const trafficLightCounts = getTrafficLightCounts(sectionObservations)
        const sectionGrade = getSectionGrade(sectionObservations)
        const showDetails = showAllDetails[section.id]
        
        // Determine if section has high severity for border color
        const hasHighSeverity = trafficLightCounts.High > 0

        return (
          <div key={section.id} className={`border rounded-lg ${hasHighSeverity ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
            {/* Section Header */}
            <div className="px-4 py-3">
              {/* Screen version with button */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between bg-blue-50 bg-opacity-90 hover:bg-blue-100 hover:bg-opacity-60 rounded-lg transition-all duration-200 -mx-2 px-2 py-2 shadow-sm hover:shadow no-print"
              >
                <div className="flex items-center space-x-3 flex-1">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600 flex-shrink-0" />
                  )}
                  
                  {/* Section Grade */}
                  {sectionGrade && (
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ 
                        backgroundColor: sectionGrade === 'A' ? '#10b981' : sectionGrade === 'B' ? '#eab308' : '#ef4444'
                      }}
                    >
                      {sectionGrade}
                    </div>
                  )}
                  
                  {/* Section Name */}
                  <div className="font-medium text-gray-900">
                    {section.name && section.name.toLowerCase().startsWith('section') 
                      ? section.name 
                      : `Section ${section.section_number}: ${section.name || ''}`}
                  </div>
                  
                  {/* Section Details - Horizontal Layout */}
                  <div className="flex items-center space-x-4 text-sm text-gray-600 flex-wrap">
                    <div className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      {section.start_ref} → {section.finish_ref}
                    </div>
                    
                    {section.direction && (
                      <div className="flex items-center">
                        <ArrowRight className="w-3 h-3 mr-1" />
                        {section.direction}
                      </div>
                    )}
                    
                    {section.diameter && (
                      <div className="flex items-center">
                        <Gauge className="w-3 h-3 mr-1" />
                        {section.diameter}
                      </div>
                    )}
                    
                    {section.material && (
                      <div className="flex items-center">
                        <Package className="w-3 h-3 mr-1" />
                        {section.material}
                      </div>
                    )}
                    
                    {section.use_type && (
                      <div className="flex items-center">
                        <Home className="w-3 h-3 mr-1" />
                        {section.use_type}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Traffic Light Severity Summary */}
                <div className="flex items-center space-x-2">
                  {['High', 'Medium', 'Low'].map(group => {
                    const count = trafficLightCounts[group]
                    if (count === 0) return null
                    return (
                      <div
                        key={group}
                        className="flex items-center px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: getTrafficLightColor(group) }}
                      >
                        {count}
                      </div>
                    )
                  })}
                  
                  <div className="text-sm text-gray-500 ml-2">
                    {sectionObservations.length} obs
                  </div>
                </div>
              </button>

              {/* Print version header */}
              <div className="hidden print:flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* Section Grade */}
                  {sectionGrade && (
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ 
                        backgroundColor: sectionGrade === 'A' ? '#10b981' : sectionGrade === 'B' ? '#eab308' : '#ef4444'
                      }}
                    >
                      {sectionGrade}
                    </div>
                  )}
                  
                  {/* Section Name */}
                  <div className="font-medium text-gray-900">
                    {section.name && section.name.toLowerCase().startsWith('section') 
                      ? section.name 
                      : `Section ${section.section_number}: ${section.name || ''}`}
                  </div>
                  
                  {/* Section Details - Horizontal Layout */}
                  <div className="flex items-center space-x-4 text-sm text-gray-600 flex-wrap">
                    <div className="flex items-center">
                      <MapPin className="w-3 h-3 mr-1" />
                      {section.start_ref} → {section.finish_ref}
                    </div>
                    
                    {section.direction && (
                      <div className="flex items-center">
                        <ArrowRight className="w-3 h-3 mr-1" />
                        {section.direction}
                      </div>
                    )}
                    
                    {section.diameter && (
                      <div className="flex items-center">
                        <Gauge className="w-3 h-3 mr-1" />
                        {section.diameter}
                      </div>
                    )}
                    
                    {section.material && (
                      <div className="flex items-center">
                        <Package className="w-3 h-3 mr-1" />
                        {section.material}
                      </div>
                    )}
                    
                    {section.use_type && (
                      <div className="flex items-center">
                        <Home className="w-3 h-3 mr-1" />
                        {section.use_type}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Traffic Light Severity Summary */}
                <div className="flex items-center space-x-2">
                  {['High', 'Medium', 'Low'].map(group => {
                    const count = trafficLightCounts[group]
                    if (count === 0) return null
                    return (
                      <div
                        key={group}
                        className="flex items-center px-2 py-1 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: getTrafficLightColor(group) }}
                      >
                        {count}
                      </div>
                    )
                  })}
                  
                  <div className="text-sm text-gray-500 ml-2">
                    {sectionObservations.length} obs
                  </div>
                </div>
              </div>

              {/* View all details toggle - screen only */}
              <div className="mt-1 no-print">
                <button
                  onClick={() => setShowAllDetails(prev => ({ ...prev, [section.id]: !prev[section.id] }))}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  {showDetails ? 'Hide' : 'Show'} all section details
                </button>
              </div>

              {/* All section details - screen version */}
              {showDetails && (
                <div className="mt-2 p-3 bg-gray-50 rounded text-sm grid grid-cols-2 md:grid-cols-3 gap-2 no-print">
                  {Object.entries(section).map(([key, value]) => {
                    if (excludedFields.includes(key) || value === null || value === undefined) return null
                    
                    return (
                      <div key={key}>
                        <span className="font-medium text-gray-600">{formatFieldName(key)}:</span>
                        <span className="ml-2 text-gray-800">{formatFieldValue(value)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            
            
            {/* Section Observations - Always visible when printing */}
            <div className={`border-t ${isExpanded ? 'block' : 'hidden'} print:block`}>
              {sectionObservations.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  No observations in this section
                </div>
              ) : (
                <>
                  {/* Pipe Graphic */}
                  <div className="px-4 pt-4">
                    <PipeGraphic 
                      observations={sectionObservations}
                      onObservationClick={(obs) => handleObservationClick(obs, section.id)}
                    />
                  </div>
                  
                  {/* Observations List */}
                  <div className="divide-y">
                    {sectionObservations
                      .sort((a, b) => a.distance - b.distance)
                      .map((obs) => (
                        <div 
                          key={obs.id} 
                          ref={el => observationRefs.current[obs.id] = el}
                          className={`px-4 py-3 transition-all duration-300 ${
                            highlightedObs === obs.id 
                              ? 'bg-blue-100 border-l-4 border-blue-500' 
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start space-x-4">
                            {/* Distance */}
                            <div className="font-medium text-gray-900 w-16 flex-shrink-0">
                              {obs.distance?.toFixed(2)}m
                            </div>
                            
                            {/* Defect Description */}
                            <div className="flex-1">
                              <div className="font-medium text-gray-800">
                                {obs.description || obs.name || `${obs.code} - No description`}
                              </div>
                              
                              {/* Defect Explanations - only show on screen when toggled */}
                              {showExplanations && getDefectExplanation(obs.code) && (
                                <div className="text-xs text-gray-600 mt-1 italic bg-blue-50 p-2 rounded border border-blue-200 no-print">
                                  <Info className="inline w-3 h-3 mr-1" />
                                  <span className="font-medium">Explanation:</span> {getDefectExplanation(obs.code)}
                                </div>
                              )}
                              
                              {/* Attributes - Enhanced Display */}
                              <div className="mt-2 space-y-1">
                                {/* Primary Attributes Row */}
                                <div className="flex flex-wrap gap-3 text-xs">
                                  {obs.clock_ref_1 && (
                                    <div className="flex items-center px-2 py-1 bg-blue-50 rounded border border-blue-200">
                                      <span className="font-medium text-blue-700">Clock:</span>
                                      <span className="ml-1 text-blue-800">{obs.clock_ref_1}{obs.clock_ref_2 ? `-${obs.clock_ref_2}` : ''}</span>
                                    </div>
                                  )}
                                  {obs.dimension_1 && (
                                    <div className="flex items-center px-2 py-1 bg-purple-50 rounded border border-purple-200">
                                      <span className="font-medium text-purple-700">Size:</span>
                                      <span className="ml-1 text-purple-800">{obs.dimension_1}mm{obs.dimension_2 ? ` × ${obs.dimension_2}mm` : ''}</span>
                                    </div>
                                  )}
                                  {obs.loss_percentage && (
                                    <div className="flex items-center px-2 py-1 bg-red-50 rounded border border-red-200">
                                      <span className="font-medium text-red-700">Cross-sectional Loss:</span>
                                      <span className="ml-1 text-red-800">{obs.loss_percentage}%</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Secondary Attributes Row */}
                                <div className="flex flex-wrap gap-3 text-xs">
                                  {obs.material && (
                                    <div className="flex items-center px-2 py-1 bg-gray-50 rounded border border-gray-200">
                                      <span className="font-medium text-gray-700">Material:</span>
                                      <span className="ml-1 text-gray-800">{obs.material}</span>
                                    </div>
                                  )}
                                  {obs.band && (
                                    <div className="flex items-center px-2 py-1 bg-indigo-50 rounded border border-indigo-200">
                                      <span className="font-medium text-indigo-700">Band:</span>
                                      <span className="ml-1 text-indigo-800">{obs.band}</span>
                                    </div>
                                  )}
                                  {obs.is_at_joint && (
                                    <div className="flex items-center px-2 py-1 bg-orange-50 rounded border border-orange-200">
                                      <span className="font-medium text-orange-700">At Joint</span>
                                    </div>
                                  )}
                                  {obs.cont_def && (
                                    <div className="flex items-center px-2 py-1 bg-yellow-50 rounded border border-yellow-200">
                                      <span className="font-medium text-yellow-700">Continuous Defect</span>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Remarks */}
                                {obs.remarks && (
                                  <div className="px-2 py-1 bg-gray-50 rounded border border-gray-200 text-xs">
                                    <span className="font-medium text-gray-700">Remarks:</span>
                                    <span className="ml-1 text-gray-800 italic">"{obs.remarks}"</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Severity - Traffic Light System */}
                            {obs.severity && (
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                                style={{ backgroundColor: getTrafficLightColor(getTrafficLightGroup(obs.severity)) }}
                                title={`Severity ${obs.severity} - ${getTrafficLightGroup(obs.severity)}`}
                              >
                                {obs.severity}
                              </div>
                            )}
                            
                            {/* Video Timecode - screen only */}
                            {obs.video_timestamp !== undefined && section.video_url && (
                              <button
                                onClick={() => handleVideoPlay(section, obs.video_timestamp)}
                                className="flex items-center text-blue-600 hover:text-blue-700 text-sm no-print"
                                title="Play video from this observation"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                {Math.floor(obs.video_timestamp / 60)}:{String(Math.floor(obs.video_timestamp % 60)).padStart(2, '0')}
                              </button>
                            )}
                            
                            {/* Image */}
                            {obs.image_url && (
                              <button
                                onClick={() => setSelectedImage(obs.image_url)}
                                className="flex-shrink-0 no-print"
                              >
                                <img
                                  src={obs.image_url}
                                  alt="Observation"
                                  className="w-16 h-16 object-cover rounded border border-gray-300 hover:border-blue-500 cursor-pointer"
                                />
                              </button>
                            )}
                            
                            {/* Image for print */}
                            {obs.image_url && (
                              <img
                                src={obs.image_url}
                                alt="Observation"
                                className="w-24 h-24 object-cover rounded border border-gray-300 hidden print:block"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}

      {/* Image Modal - never print */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 no-print"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="Enlarged observation"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Video Modal - never print */}
      {videoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium text-gray-900">Video: {videoModal.sectionName}</h3>
              <button
                onClick={() => setVideoModal(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <video
                src={videoModal.url}
                controls
                autoPlay
                className="w-full"
                onLoadedMetadata={(e) => {
                  e.target.currentTime = videoModal.startTime
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}