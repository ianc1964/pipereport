'use client'
import { Monitor, Database, Split, Map, RotateCcw } from 'lucide-react'

export default function LayoutControls({
  layoutMode,
  splitRatio,
  activeSectionData,
  onSetVideoMode,
  onSetDataMode,
  onSetSplitMode,
  onSetMapMode,
  onSetSplitRatio,
  onResetLayout
}) {
  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-700">Layout:</span>
        
        {/* Layout Mode Buttons */}
        <div className="flex space-x-1 bg-gray-100 rounded-md p-1">
          <button
            onClick={onSetVideoMode}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              layoutMode === 'video' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Video Only"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={onSetDataMode}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              layoutMode === 'data' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Data Only"
          >
            <Database className="w-4 h-4" />
          </button>
          <button
            onClick={onSetSplitMode}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              layoutMode === 'split' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Split View"
          >
            <Split className="w-4 h-4" />
          </button>
          <button
            onClick={onSetMapMode}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              layoutMode === 'map' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Map View"
          >
            <Map className="w-4 h-4" />
          </button>
        </div>

        {/* Split Ratio Controls */}
        {layoutMode === 'split' && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Split:</span>
            <button
              onClick={() => onSetSplitRatio(30)}
              className={`px-2 py-1 text-xs rounded ${
                splitRatio === 30 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              30/70
            </button>
            <button
              onClick={() => onSetSplitRatio(50)}
              className={`px-2 py-1 text-xs rounded ${
                splitRatio === 50 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              50/50
            </button>
            <button
              onClick={() => onSetSplitRatio(70)}
              className={`px-2 py-1 text-xs rounded ${
                splitRatio === 70 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              70/30
            </button>
          </div>
        )}

        <button
          onClick={onResetLayout}
          className="text-gray-500 hover:text-gray-700 p-1"
          title="Reset Layout"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Active Section Info */}
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">Active:</span>
        {activeSectionData ? (
          <span className="text-sm font-medium text-gray-900">{activeSectionData.name}</span>
        ) : (
          <span className="text-sm text-gray-400">No section selected</span>
        )}
      </div>
    </div>
  )
}