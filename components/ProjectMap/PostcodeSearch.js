'use client'
import { useState } from 'react'
import { Search, Loader2, MapPin, X } from 'lucide-react'
import L from 'leaflet'

export default function PostcodeSearch({ map, visible = true }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState(null)

  // Search for postcodes/addresses using Nominatim
  const handleSearch = async (e) => {
    e.preventDefault()
    
    if (!searchQuery.trim() || !map) return
    
    setIsSearching(true)
    setError(null)
    setSearchResults([])
    
    try {
      // Use Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=gb&limit=5`,
        {
          headers: {
            'User-Agent': 'VideoAnalysisApp/1.0' // Good practice to identify your app
          }
        }
      )
      
      if (!response.ok) {
        throw new Error('Search failed')
      }
      
      const data = await response.json()
      
      if (data.length === 0) {
        setError('No results found. Try a different postcode or address.')
      } else {
        setSearchResults(data)
        setShowResults(true)
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  // Navigate to selected location
  const handleSelectLocation = (result) => {
    if (!map) return
    
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    
    // Check if the result has a bounding box
    if (result.boundingbox && result.boundingbox.length === 4) {
      // Use bounding box for perfect fit
      const bounds = [
        [parseFloat(result.boundingbox[0]), parseFloat(result.boundingbox[2])], // South-West
        [parseFloat(result.boundingbox[1]), parseFloat(result.boundingbox[3])]  // North-East
      ]
      map.fitBounds(bounds, { 
        padding: [50, 50], // Add some padding around the bounds
        animate: true,
        maxZoom: 20 // Google Maps supports higher zoom levels
      })
    } else {
      // Determine zoom level based on result type
      let zoomLevel = 20 // Default to high zoom for specific addresses (Google Maps supports this)
      
      // Adjust zoom based on result type/class
      if (result.type === 'postcode' || result.class === 'place') {
        zoomLevel = 17
      } else if (result.type === 'city' || result.type === 'town') {
        zoomLevel = 13
      } else if (result.type === 'suburb' || result.type === 'neighbourhood') {
        zoomLevel = 16
      } else if (result.type === 'road' || result.type === 'street') {
        zoomLevel = 18
      } else if (result.type === 'house' || result.type === 'building') {
        zoomLevel = 20 // Google Maps can handle zoom 20+
      }
      
      map.setView([lat, lng], zoomLevel, { animate: true })
    }
    
    // Add a temporary marker after a short delay to ensure map has moved
    setTimeout(() => {
      const tempMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="
            background: #3B82F6;
            color: white;
            padding: 8px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            font-weight: bold;
          ">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
            </svg>
          </div>`,
          className: 'search-result-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        })
      }).addTo(map)
      
      // Remove marker after 5 seconds
      setTimeout(() => {
        map.removeLayer(tempMarker)
      }, 5000)
    }, 300) // Small delay to ensure map animation has started
    
    // Clear search
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
  }

  if (!visible) return null

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter postcode or address..."
            className="w-full pl-3 pr-8 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isSearching}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
                setShowResults(false)
                setError(null)
              }}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <button
          type="submit"
          disabled={!searchQuery.trim() || isSearching}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>Search</span>
        </button>
      </form>

      {/* Error message */}
      {error && (
        <div className="absolute top-full mt-1 w-full max-w-sm bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700 z-50">
          {error}
        </div>
      )}

      {/* Search results dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full mt-1 w-full max-w-sm bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1 max-h-60 overflow-y-auto">
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => handleSelectLocation(result)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {result.display_name.split(',')[0]}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {result.display_name}
                    </div>
                    {result.type && (
                      <div className="text-xs text-gray-400 capitalize">
                        {result.type.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}