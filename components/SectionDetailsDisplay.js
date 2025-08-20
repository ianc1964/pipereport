// components/SectionDetailsDisplay.js
'use client'

import { 
  MapPin, 
  Ruler, 
  Calendar, 
  Cloud, 
  Layers,
  Navigation,
  Circle,
  Info
} from 'lucide-react'

export default function SectionDetailsDisplay({ section }) {
  if (!section) return null

  // Helper function to format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Helper to display value or N/A
  const displayValue = (value) => {
    if (value === null || value === undefined || value === '') return 'N/A'
    return value
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Info className="w-4 h-4" />
        Section Details
      </h4>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Section:</span>
          <span className="ml-2 font-medium">{section.name}</span>
        </div>
        <div>
          <span className="text-gray-500">Number:</span>
          <span className="ml-2 font-medium">#{section.section_number}</span>
        </div>
      </div>

      {/* Start/Finish Info */}
      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <MapPin className="w-4 h-4 text-green-600" />
            Start Point
          </div>
          <div className="text-sm space-y-1 pl-6">
            <div>
              <span className="text-gray-500">Ref:</span>
              <span className="ml-2 font-medium">{displayValue(section.start_ref)}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2">{displayValue(section.start_type)}</span>
            </div>
            <div>
              <span className="text-gray-500">Depth:</span>
              <span className="ml-2">{section.start_depth ? `${section.start_depth}m` : 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <MapPin className="w-4 h-4 text-red-600" />
            Finish Point
          </div>
          <div className="text-sm space-y-1 pl-6">
            <div>
              <span className="text-gray-500">Ref:</span>
              <span className="ml-2 font-medium">{displayValue(section.finish_ref)}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2">{displayValue(section.finish_type)}</span>
            </div>
            <div>
              <span className="text-gray-500">Depth:</span>
              <span className="ml-2">{section.finish_depth ? `${section.finish_depth}m` : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipe Details */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Circle className="w-4 h-4 text-blue-600" />
          Pipe Specifications
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pl-6">
          <div>
            <span className="text-gray-500">Direction:</span>
            <span className="ml-2">{displayValue(section.direction)}</span>
          </div>
          <div>
            <span className="text-gray-500">Diameter:</span>
            <span className="ml-2">{section.diameter ? `${section.diameter}mm` : 'N/A'}</span>
          </div>
          <div>
            <span className="text-gray-500">Material:</span>
            <span className="ml-2">{displayValue(section.material)}</span>
          </div>
          <div>
            <span className="text-gray-500">Shape:</span>
            <span className="ml-2">{displayValue(section.shape)}</span>
          </div>
          <div>
            <span className="text-gray-500">Use Type:</span>
            <span className="ml-2">{displayValue(section.use_type)}</span>
          </div>
          <div>
            <span className="text-gray-500">Section Type:</span>
            <span className="ml-2">{displayValue(section.section_type)}</span>
          </div>
        </div>
      </div>

      {/* Lining Details if present */}
      {(section.lining_type || section.lining_material) && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Layers className="w-4 h-4 text-purple-600" />
            Lining Details
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pl-6">
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2">{displayValue(section.lining_type)}</span>
            </div>
            <div>
              <span className="text-gray-500">Material:</span>
              <span className="ml-2">{displayValue(section.lining_material)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Details */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Calendar className="w-4 h-4 text-orange-600" />
          Inspection Information
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pl-6">
          <div>
            <span className="text-gray-500">Date:</span>
            <span className="ml-2">{formatDate(section.inspection_date)}</span>
          </div>
          <div>
            <span className="text-gray-500">Weather:</span>
            <span className="ml-2">{displayValue(section.weather)}</span>
          </div>
          <div>
            <span className="text-gray-500">Purpose:</span>
            <span className="ml-2">{displayValue(section.inspection_purpose)}</span>
          </div>
          <div>
            <span className="text-gray-500">Method:</span>
            <span className="ml-2">{displayValue(section.survey_method)}</span>
          </div>
          <div>
            <span className="text-gray-500">Flow Control:</span>
            <span className="ml-2">{displayValue(section.flow_control)}</span>
          </div>
          <div>
            <span className="text-gray-500">Precleaned:</span>
            <span className="ml-2">{displayValue(section.precleaned)}</span>
          </div>
        </div>
      </div>

      {/* Remarks if present */}
      {section.general_remarks && (
        <div className="pt-3 border-t border-gray-200">
          <div className="text-sm">
            <span className="text-gray-700 font-medium">Remarks:</span>
            <p className="mt-1 text-gray-600 italic">{section.general_remarks}</p>
          </div>
        </div>
      )}
    </div>
  )
}