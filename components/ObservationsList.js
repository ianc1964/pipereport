'use client'

import StartFinishReminder from './StartFinishReminder'
import { useState, useEffect, useRef } from 'react'
import { 
  Edit2, 
  Trash2, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Plus,
  X,
  CheckCircle,
  Play,
  Clock
} from 'lucide-react'
import { 
  getObservations, 
  deleteObservation, 
  updateObservation,
  formatObservationDisplay 
} from '../lib/observations.js'

export default function ObservationsList({ 
  sectionId, 
  onEditObservation, 
  onAddObservation,
  onJumpToTimestamp,
  refreshTrigger,
  hideAddButton = false,
  lastSavedObservationId = null
}) {
  const [observations, setObservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('distance')
  const [sortOrder, setSortOrder] = useState('asc')
  const [selectedImage, setSelectedImage] = useState(null)
  const [hoveredImage, setHoveredImage] = useState(null)
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 })
  const [highlightedObservationId, setHighlightedObservationId] = useState(null)
  const observationRefs = useRef({})
  const hoverTimeoutRef = useRef(null)
  const isHoveringPreview = useRef(false)

  // Load observations
  useEffect(() => {
    const loadObservations = async () => {
      if (!sectionId) return
      
      try {
        setLoading(true)
        const data = await getObservations(sectionId, sortBy, sortOrder)
        setObservations(data.map(formatObservationDisplay))
      } catch (error) {
        console.error('Failed to load observations:', error)
      } finally {
        setLoading(false)
      }
    }

    loadObservations()
  }, [sectionId, sortBy, sortOrder, refreshTrigger])

  // Scroll to and highlight the last saved observation
  useEffect(() => {
    if (lastSavedObservationId && observations.length > 0) {
      const observationExists = observations.some(obs => obs.id === lastSavedObservationId)
      
      if (observationExists) {
        setHighlightedObservationId(lastSavedObservationId)
        
        setTimeout(() => {
          const element = observationRefs.current[lastSavedObservationId]
          if (element) {
            element.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center'
            })
          }
        }, 100)
        
        const highlightTimeout = setTimeout(() => {
          setHighlightedObservationId(null)
        }, 3000)
        
        return () => clearTimeout(highlightTimeout)
      }
    }
  }, [lastSavedObservationId, observations])

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const handleDelete = async (observationId) => {
    if (!confirm('Are you sure you want to delete this observation? This action cannot be undone.')) {
      return
    }

    try {
      await deleteObservation(observationId)
      setObservations(prev => prev.filter(obs => obs.id !== observationId))
    } catch (error) {
      console.error('Failed to delete observation:', error)
      alert('Failed to delete observation. Please try again.')
    }
  }

  const handleTimestampClick = (timestamp, observationName) => {
    console.log('Timestamp clicked:', timestamp, 'for observation:', observationName)
    if (onJumpToTimestamp && timestamp !== null && timestamp !== undefined) {
      onJumpToTimestamp(timestamp)
    } else {
      console.warn('Cannot jump to timestamp:', { hasCallback: !!onJumpToTimestamp, timestamp })
    }
  }

  const formatTimestamp = (timeInSeconds) => {
    if (timeInSeconds === null || timeInSeconds === undefined) return '--:--'
    
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const TimestampDisplay = ({ timestamp, observationName }) => {
    if (timestamp === null || timestamp === undefined) {
      return (
        <div className="text-gray-400 text-sm">
          No timestamp
        </div>
      )
    }

    return (
      <button
        onClick={() => handleTimestampClick(timestamp, observationName)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors group"
        title={`Jump to ${formatTimestamp(timestamp)} in video`}
      >
        <Clock className="w-4 h-4 text-blue-600" />
        <span className="text-blue-700 font-medium">
          {formatTimestamp(timestamp)}
        </span>
        <Play className="w-3 h-3 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  }

  const getSortIcon = (field) => {
    if (sortBy !== field) return <ArrowUpDown className="w-4 h-4" />
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-4 h-4" /> 
      : <ArrowDown className="w-4 h-4" />
  }

  const formatDistance = (distance) => {
    if (distance === null || distance === undefined) return '0.0'
    return Number(distance).toFixed(1)
  }

  // Build observation details for display
  const buildObservationDetails = (observation) => {
    const parts = []
    
    if (observation.type || observation.section_type) {
      parts.push(`Type: ${observation.type || observation.section_type}`)
    }
    
    if (observation.band) parts.push(`Band: ${observation.band}`)
    if (observation.material) parts.push(`Material: ${observation.material}`)
    
    if (observation.is_at_joint) parts.push(`At Joint`)
    
    if (observation.loss_percentage) parts.push(`${observation.loss_percentage}% Loss`)
    
    if (observation.clock_ref_1) {
      if (observation.clock_ref_2) {
        parts.push(`Clock: ${observation.clock_ref_1}/${observation.clock_ref_2}`)
      } else {
        parts.push(`Clock: ${observation.clock_ref_1}`)
      }
    }
    
    if (observation.dimension_1) {
      if (observation.dimension_2) {
        parts.push(`Dimensions: ${observation.dimension_1}×${observation.dimension_2}`)
      } else {
        parts.push(`Dimension: ${observation.dimension_1}`)
      }
    }
    
    if (observation.continuous_defect_starts || observation.cont_def_starts) {
      parts.push(`Continuous Defect Starts`)
    }
    
    if (observation.continuous_defect_ends || observation.cont_def_ends) {
      parts.push(`Continuous Defect Ends`)
    }
    
    if (observation.cont_def) {
      parts.push(`Continuous Defect`)
    }
    
    if (observation.remarks) {
      parts.push(`"${observation.remarks}"`)
    }
    
    return parts
  }

  const handleMouseEnter = (imageUrl, event) => {
    if (!imageUrl) return
    
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    
    const rect = event.currentTarget.getBoundingClientRect()
    const previewWidth = 300  // Increased from 192
    const previewHeight = 400  // Increased from 240, max height
    const offset = 15
    
    let x = rect.right + offset
    let y = rect.top
    
    // Check if preview would go off right edge
    if (x + previewWidth > window.innerWidth) {
      x = rect.left - previewWidth - offset
    }
    
    // Check if preview would go off bottom
    if (y + previewHeight > window.innerHeight) {
      y = window.innerHeight - previewHeight - 20
    }
    
    // Check if preview would go off top
    if (y < 20) {
      y = 20
    }
    
    // If still off screen horizontally, center it
    if (x < 10) {
      x = (window.innerWidth - previewWidth) / 2
    }
    
    setHoverPosition({ x, y })
    setHoveredImage(imageUrl)
  }

  const handleMouseLeave = () => {
    // Add a small delay to allow mouse to move to preview
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveringPreview.current) {
        setHoveredImage(null)
      }
    }, 100)  // Reduced from 50ms and made more stable
  }

  const handlePreviewMouseEnter = () => {
    isHoveringPreview.current = true
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }

  const handlePreviewMouseLeave = () => {
    isHoveringPreview.current = false
    setHoveredImage(null)
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Handle escape key to close preview
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && hoveredImage) {
        setHoveredImage(null)
        isHoveringPreview.current = false
      }
    }

    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [hoveredImage])

  const ImageThumbnail = ({ imageUrl, alt }) => {
    if (!imageUrl) {
      return (
        <div className="w-16 h-16 bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
          <span className="text-xs text-gray-400">No image</span>
        </div>
      )
    }

    return (
      <img
        src={imageUrl}
        alt={alt}
        className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-75 hover:ring-2 hover:ring-blue-400 transition-all duration-200"
        onClick={(e) => {
          e.stopPropagation()
          setSelectedImage(imageUrl)
        }}
        onMouseEnter={(e) => handleMouseEnter(imageUrl, e)}
        onMouseLeave={handleMouseLeave}
        title="Hover to preview • Click to view full size"
      />
    )
  }

  const getSeverityStats = () => {
    const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    observations.forEach(obs => {
      if (obs.severity >= 1 && obs.severity <= 5) {
        stats[obs.severity]++
      }
    })
    return stats
  }

  const severityStats = getSeverityStats()

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Observations ({observations.length})
        </h3>
        {!hideAddButton && (
          <button
            onClick={onAddObservation}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Observation
          </button>
        )}
      </div>

      {observations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No observations yet.</p>
          <p className="text-sm">Click "Add Observation" to create your first observation.</p>
        </div>
      ) : (
        <>
          
          {/* Observations Table */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('distance')}
                    >
                      <div className="flex items-center gap-1">
                        Distance (M) {getSortIcon('distance')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Image
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('video_timestamp')}
                    >
                      <div className="flex items-center gap-1">
                        Video Time {getSortIcon('video_timestamp')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('severity')}
                    >
                      <div className="flex items-center gap-1">
                        Severity {getSortIcon('severity')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {observations.map((observation) => {
                    const details = buildObservationDetails(observation)
                    const isHighlighted = highlightedObservationId === observation.id
                    
                    return (
                      <tr 
                        key={observation.id} 
                        ref={el => observationRefs.current[observation.id] = el}
                        className={`
                          hover:bg-gray-50 transition-all duration-300
                          ${isHighlighted ? 'bg-blue-50 ring-2 ring-blue-400 ring-inset' : ''}
                        `}
                        style={{
                          animation: isHighlighted ? 'highlight-fade 3s ease-out' : 'none'
                        }}
                      >
                        {/* Distance Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-medium text-gray-900">
                            {formatDistance(observation.distance)}
                          </div>
                        </td>

                        {/* Details Column */}
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-900">
                              {observation.code} - {observation.description}
                            </div>
                            
                            {details.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {details.map((detail, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    {detail}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Image Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ImageThumbnail 
                            imageUrl={observation.image_url} 
                            alt={`Observation at ${formatDistance(observation.distance)}m`}
                          />
                        </td>

                        {/* Timestamp Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <TimestampDisplay 
                            timestamp={observation.video_timestamp}
                            observationName={observation.name || observation.code}
                          />
                        </td>

                        {/* Severity Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {observation.severity ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                              observation.severity >= 4 
                                ? 'bg-red-100 text-red-800' 
                                : observation.severity >= 3 
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                            }`}>
                              {observation.severity}
                            </span>
                          ) : null}
                        </td>

                        {/* Actions Column */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onEditObservation(observation)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Edit observation"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(observation.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete observation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Severity Statistics - Now Sticky */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 pt-4 z-10">
            {/* Severity boxes - now smaller */}
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 text-sm mb-3">
              <div className="bg-blue-50 p-2 rounded">
                <div className="text-blue-800 font-medium text-xs">Total</div>
                <div className="text-xl font-bold text-blue-900">{observations.length}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-800 font-medium text-xs">With Video</div>
                <div className="text-xl font-bold text-gray-900">
                  {observations.filter(obs => obs.video_timestamp !== null).length}
                </div>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <div className="text-green-800 font-medium text-xs">Severity 1</div>
                <div className="text-xl font-bold text-green-900">{severityStats[1]}</div>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <div className="text-green-800 font-medium text-xs">Severity 2</div>
                <div className="text-xl font-bold text-green-900">{severityStats[2]}</div>
              </div>
              <div className="bg-yellow-50 p-2 rounded">
                <div className="text-yellow-800 font-medium text-xs">Severity 3</div>
                <div className="text-xl font-bold text-yellow-900">{severityStats[3]}</div>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <div className="text-red-800 font-medium text-xs">Severity 4</div>
                <div className="text-xl font-bold text-red-900">{severityStats[4]}</div>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <div className="text-red-800 font-medium text-xs">Severity 5</div>
                <div className="text-xl font-bold text-red-900">{severityStats[5]}</div>
              </div>
            </div>
            
            {/* START/FINISH Reminder - below the severity boxes */}
            <StartFinishReminder observations={observations} />
          </div>
              
        </>
      )}    

      {/* Add custom styles for the highlight animation */}
      <style jsx>{`
        @keyframes highlight-fade {
          0% {
            background-color: rgb(239 246 255);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
          }
          50% {
            background-color: rgb(239 246 255);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
          }
          100% {
            background-color: transparent;
            box-shadow: none;
          }
        }
      `}</style>

      {/* Hover Preview Image - Improved */}
      {hoveredImage && (
        <div
          className="fixed z-40 pointer-events-none"
          style={{
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y}px`,
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl border-2 border-blue-400 p-3 pointer-events-auto"
            onMouseEnter={handlePreviewMouseEnter}
            onMouseLeave={handlePreviewMouseLeave}
          >
            <div className="max-w-[300px] max-h-[400px] overflow-hidden">
              <img
                src={hoveredImage}
                alt="Hover preview"
                className="w-auto h-auto max-w-full max-h-full object-contain rounded cursor-pointer"
                onClick={() => {
                  setSelectedImage(hoveredImage)
                  setHoveredImage(null)
                  isHoveringPreview.current = false
                }}
              />
            </div>
            <div className="text-xs text-gray-600 text-center mt-2 px-2">
              <div>Preview • Click for full size</div>
              <div className="text-gray-400">Press ESC to close</div>
            </div>
          </div>
        </div>
      )}

      {/* Full-size Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2 z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Full size observation"
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}