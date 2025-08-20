// components/reports/SettingsTab.js
// Report settings and configuration - SIMPLIFIED WEATHER

import { useState, useEffect } from 'react'
import { 
  Cloud, 
  Building,
  Palette,
  FileText,
  Eye,
  Lock
} from 'lucide-react'
import { getBrandingProfiles } from '../../lib/reports'

export default function SettingsTab({ report, updateReport, isReadOnly }) {
  const [brandingProfiles, setBrandingProfiles] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  
  // Local state for form fields - simplified weather
  const [weatherConditions, setWeatherConditions] = useState(report.weather_conditions || '')
  const [brandingProfileId, setBrandingProfileId] = useState(report.branding_profile_id || '')
  
  useEffect(() => {
    loadBrandingProfiles()
  }, [])
  
  const loadBrandingProfiles = async () => {
    try {
      const profiles = await getBrandingProfiles()
      setBrandingProfiles(profiles)
    } catch (error) {
      console.error('Error loading branding profiles:', error)
    } finally {
      setLoadingProfiles(false)
    }
  }
  
  const handleWeatherChange = (value) => {
    setWeatherConditions(value)
    updateReport('weather_conditions', value)
  }
  
  const handleBrandingChange = (profileId) => {
    setBrandingProfileId(profileId)
    updateReport('branding_profile_id', profileId || null)
  }
  
  // Get selected branding profile details
  const selectedProfile = brandingProfiles.find(p => p.id === brandingProfileId)

  return (
    <div className="p-6 space-y-8">
      {/* Report Status Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center">
          {report.status === 'final' ? (
            <>
              <Lock className="h-5 w-5 text-green-500 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Report Finalized</h4>
                <p className="text-sm text-gray-500">
                  This report was finalized on {new Date(report.finalized_at).toLocaleDateString()} 
                  and cannot be edited. The settings below are shown for reference only.
                </p>
              </div>
            </>
          ) : (
            <>
              <FileText className="h-5 w-5 text-blue-500 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-gray-900">Draft Report</h4>
                <p className="text-sm text-gray-500">
                  You can modify these settings until the report is finalized.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Weather Conditions - Simplified */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Cloud className="h-5 w-5 mr-2 text-gray-400" />
          Inspection Conditions
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Cloud className="inline h-4 w-4 mr-1" />
            Weather Conditions
          </label>
          <textarea
            value={weatherConditions}
            onChange={(e) => handleWeatherChange(e.target.value)}
            placeholder="e.g., Clear, sunny, 22°C. Dry conditions for past week."
            disabled={isReadOnly}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="mt-2 text-sm text-gray-500">
            Include current weather, temperature, and recent weather patterns that may affect the inspection conditions.
          </p>
        </div>
      </div>
      
      {/* Branding Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Palette className="h-5 w-5 mr-2 text-gray-400" />
          Report Branding
        </h3>
        
        {loadingProfiles ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading branding profiles...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Building className="inline h-4 w-4 mr-1" />
                Branding Profile
              </label>
              <select
                value={brandingProfileId}
                onChange={(e) => handleBrandingChange(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">No branding (plain report)</option>
                {brandingProfiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} {profile.is_default && '(Default)'}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedProfile && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Selected Branding Preview</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Company</p>
                    <p className="text-sm text-gray-700">
                      {selectedProfile.company_name_override || 'Not specified'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Colors</p>
                    <div className="flex space-x-2">
                      <div 
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: selectedProfile.primary_color }}
                        title="Primary"
                      />
                      <div 
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: selectedProfile.secondary_color }}
                        title="Secondary"
                      />
                      <div 
                        className="w-6 h-6 rounded border border-gray-300"
                        style={{ backgroundColor: selectedProfile.accent_color }}
                        title="Accent"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fonts</p>
                    <p className="text-sm text-gray-700">
                      {selectedProfile.heading_font} / {selectedProfile.body_font}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Features</p>
                    <p className="text-sm text-gray-700">
                      {selectedProfile.show_table_of_contents && 'TOC'} 
                      {selectedProfile.watermark_enabled && ' • Watermark'}
                    </p>
                  </div>
                </div>
                
                {selectedProfile.logo_url && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Logo Preview</p>
                    <img 
                      src={selectedProfile.logo_url} 
                      alt="Company Logo" 
                      className="h-12 object-contain"
                    />
                  </div>
                )}
              </div>
            )}
            
            {brandingProfiles.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  No branding profiles found. Create a branding profile in your account settings to add your company logo and colors to reports.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Report Metadata */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-gray-400" />
          Report Information
        </h3>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Report Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{report.report_number}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Version</dt>
              <dd className="mt-1 text-sm text-gray-900">Version {report.version}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(report.created_at).toLocaleDateString()} at {new Date(report.created_at).toLocaleTimeString()}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Created By</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {report.created_by_profile?.full_name || 'Unknown'}
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Project</dt>
              <dd className="mt-1 text-sm text-gray-900">{report.project_snapshot?.name}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Template</dt>
              <dd className="mt-1 text-sm text-gray-900">Comprehensive Report</dd>
            </div>
          </dl>
        </div>
      </div>
      
      {/* Preview Reminder */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Eye className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Preview Your Report</h4>
            <p className="text-sm text-blue-700 mt-1">
              Use the Preview button in the header to see how your report will look with the selected branding and settings applied.
              {!isReadOnly && ' Make sure to save your changes before previewing.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}