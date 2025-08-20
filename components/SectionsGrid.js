'use client'
import { Plus, Edit2, X, Monitor, Upload, FileText } from 'lucide-react'

export default function SectionsGrid({
  sections,
  activeSection,
  sectionObservations,
  uploadingSectionId,
  deletingSectionId,
  getSeverityDistribution,
  onSectionClick,
  onEditSection,
  onDeleteSection,
  onUploadVideo,
  onAddSection
}) {
  if (sections.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="max-w-sm mx-auto">
          <svg className="mx-auto h-8 w-8 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m3 0v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4m0 0h16" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">No sections yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Add sections to organize your video analysis work.
          </p>
          <button 
            onClick={onAddSection}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            Add First Section
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {sections.map(section => {
        const sectionObsCount = sectionObservations[section.id]?.length || 0
        const severity = getSeverityDistribution(section.id)
        
        return (
          <div 
            key={section.id} 
            className={`bg-white border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer relative group ${
              activeSection === section.id ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50' : 'border-gray-200'
            }`}
            onClick={() => onSectionClick(section.id)}
          >
            {/* Section Number Badge */}
            <div className="absolute -top-2 -left-2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
              {section.section_number}
            </div>

            {/* Action Buttons Row */}
            <div className="absolute -top-2 right-0 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEditSection(section)
                }}
                className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-green-600"
                title="Edit section details"
              >
                <Edit2 className="w-3 h-3" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteSection(section.id)
                }}
                disabled={deletingSectionId === section.id}
                className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 disabled:opacity-50"
                title="Delete section"
              >
                {deletingSectionId === section.id ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            </div>

            {/* Section Content */}
            <div className="mb-2">
              {/* Always show Start/Finish refs */}
              <div className="text-xs font-medium text-gray-900 mb-1">
                {section.start_ref || 'No Start'} → {section.finish_ref || 'No Finish'}
              </div>
              
              {/* Responsive details */}
              <div className="text-xs text-gray-600 space-y-0.5">
                {/* Always show direction */}
                {section.direction && (
                  <div className="truncate">Dir: {section.direction}</div>
                )}
                
                {/* Show on medium screens and up */}
                <div className="hidden md:block space-y-0.5">
                  {section.diameter && (
                    <div className="truncate">Ø {section.diameter}mm</div>
                  )}
                  {section.use_type && (
                    <div className="truncate">Use: {section.use_type}</div>
                  )}
                </div>
                
                {/* Show on large screens and up */}
                <div className="hidden lg:block space-y-0.5">
                  {section.material && (
                    <div className="truncate">Mat: {section.material}</div>
                  )}
                </div>
              </div>
              
              {/* Severity Indicators */}
              {sectionObsCount > 0 && (
                <div className="flex items-center space-x-1 mt-2">
                  {severity.critical > 0 && (
                    <div className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold" title="Critical Severity">
                      {severity.critical}
                    </div>
                  )}
                  {severity.high > 0 && (
                    <div className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold" title="High Severity">
                      {severity.high}
                    </div>
                  )}
                  {severity.medium > 0 && (
                    <div className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold" title="Medium Severity">
                      {severity.medium}
                    </div>
                  )}
                  {severity.low > 0 && (
                    <div className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold" title="Low Severity">
                      {severity.low}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <FileText className="w-3 h-3" />
                  <span>{sectionObsCount}</span>
                </div>
                {activeSection === section.id && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            </div>
            
            <div className="text-xs mb-2">
              {section.video_url ? (
                <div className="flex items-center text-green-600">
                  <Monitor className="w-3 h-3 mr-1" />
                  <span>Video ready</span>
                </div>
              ) : (
                <div className="flex items-center text-gray-400">
                  <Upload className="w-3 h-3 mr-1" />
                  <span>No video</span>
                </div>
              )}
            </div>

            {!section.video_url && uploadingSectionId !== section.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onUploadVideo(section.id)
                }}
                className="w-full text-xs bg-blue-50 text-blue-600 py-1 px-2 rounded hover:bg-blue-100 transition-colors"
              >
                Upload Video
              </button>
            )}

            {uploadingSectionId === section.id && (
              <div className="text-xs text-blue-600 text-center py-1">Uploading...</div>
            )}
          </div>
        )
      })}
      
      {/* Add Section Card */}
      <div 
        className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer flex flex-col items-center justify-center"
        onClick={onAddSection}
      >
        <Plus className="w-6 h-6 text-gray-400 mb-1" />
        <span className="text-xs text-gray-600">Add Section</span>
      </div>
    </div>
  )
}