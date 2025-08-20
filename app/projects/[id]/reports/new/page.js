// app/projects/[id]/reports/new/page.js
// Simplified report generation page - no template selection

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, 
  ChevronLeft,
  Info,
  Building,
  Palette,
  Cloud
} from 'lucide-react'
import { createReport, getBrandingProfiles, createBrandingProfile } from '../../../../../lib/reports'
import { supabase } from '../../../../../lib/supabase'
import HelpIcon from '@/components/help/HelpIcon'

export default function NewReportPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id
  
  const [project, setProject] = useState(null)
  const [brandingProfiles, setBrandingProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  
  // Simplified form state - no template selection
  const [reportTitle, setReportTitle] = useState('')
  const [brandingProfileId, setBrandingProfileId] = useState('')
  const [weatherConditions, setWeatherConditions] = useState('')
  
  
  // Quick branding setup
  const [showQuickBranding, setShowQuickBranding] = useState(false)
  const [quickBrandingName, setQuickBrandingName] = useState('Default Branding')

  useEffect(() => {
    loadProjectAndBranding()
  }, [projectId])

  const loadProjectAndBranding = async () => {
    try {
      setLoading(true)
      
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      
      if (projectError) throw projectError
      setProject(projectData)
      
      // Set default title
      setReportTitle(`Inspection Report - ${projectData.name}`)
      
      // Load branding profiles
      const profiles = await getBrandingProfiles()
      setBrandingProfiles(profiles)
      
      // Select default profile if exists
      const defaultProfile = profiles.find(p => p.is_default)
      if (defaultProfile) {
        setBrandingProfileId(defaultProfile.id)
      }
      
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickBrandingSetup = async () => {
    try {
      // Get user's company details
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      // Create a basic branding profile
      const brandingData = {
        name: quickBrandingName,
        company_name_override: profile?.company_name,
        logo_url: profile?.company_logo_url,
        is_default: true,
        primary_color: '#1e40af',
        secondary_color: '#3b82f6',
        accent_color: '#f59e0b'
      }
      
      const newProfile = await createBrandingProfile(brandingData)
      
      // Reload profiles
      const profiles = await getBrandingProfiles()
      setBrandingProfiles(profiles)
      setBrandingProfileId(newProfile.id)
      setShowQuickBranding(false)
      
    } catch (err) {
      console.error('Error creating branding profile:', err)
      alert('Failed to create branding profile: ' + err.message)
    }
  }

  const handleGenerateReport = async (e) => {
    e.preventDefault()
    setGenerating(true)
    setError(null)
    
    try {
      // Create the report - no template parameter needed
      const report = await createReport(projectId, {
        title: reportTitle,
        brandingProfileId: brandingProfileId || null,
        weatherConditions
      })
      
      // Redirect to report editor
      router.push(`/projects/${projectId}/reports/${report.id}`)
      
    } catch (err) {
      console.error('Failed to generate report:', err)
      setError(err.message)
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href={`/projects/${projectId}/reports`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Reports
        </Link>
        
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900">Generate New Report</h1>
          <HelpIcon
            title="Report Generation"
            content="Create a comprehensive professional inspection report with all your project data."
            bullets={[
              "Captures a snapshot of all current project data",
              "Includes all sections, observations, and maps",
              "Professional format suitable for all audiences",
              "Once finalized, reports become read-only",
              "Can be shared via public links and exported to PDF"
            ]}
            modal={true}
          />
        </div>
        <p className="mt-2 text-gray-600">
          Create a comprehensive inspection report for {project?.name}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleGenerateReport} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Info className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">Report Details</h2>
            <HelpIcon
              title="Report Settings"
              content="Configure the basic settings for your comprehensive report."
              bullets={[
                "Title appears on cover page and headers",
                "Report includes all sections with complete details",
                "Settings can be modified until report is finalized"
              ]}
              size="sm"
              className="ml-2"
            />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Report Title
              </label>
              <HelpIcon
                title="Report Title"
                content="The main title that appears on the report cover and headers."
                bullets={[
                  "Automatically includes project name",
                  "Can be customized for specific audiences",
                  "Example: 'Q4 2024 Pipeline Inspection - Main Street'"
                ]}
                size="sm"
              />
            </div>
            <input
              type="text"
              id="title"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            <p className="mt-1 text-sm text-gray-500">
              Comprehensive report with all sections, findings, and recommendations
            </p>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Palette className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">Branding</h2>
            <HelpIcon
              title="Report Branding"
              content="Apply your company branding to create professional reports."
              bullets={[
                "Adds company logo to report headers",
                "Applies custom color scheme throughout",
                "Includes company contact information",
                "Creates consistent brand experience",
                "Can be configured in Company Dashboard"
              ]}
              size="sm"
              className="ml-2"
            />
          </div>
          
          {brandingProfiles.length === 0 ? (
            <div className="text-center py-4">
              <Building className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-4">
                No branding profiles found. Set up your company branding to create professional reports.
              </p>
              {!showQuickBranding ? (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickBranding(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Quick Setup
                  </button>
                  <HelpIcon
                    title="Quick Branding Setup"
                    content="Create a basic branding profile quickly."
                    bullets={[
                      "Sets up default colors and styling",
                      "Can be customized later in Company Dashboard",
                      "Automatically becomes default profile"
                    ]}
                    size="sm"
                  />
                </div>
              ) : (
                <div className="space-y-3 max-w-sm mx-auto">
                  <input
                    type="text"
                    value={quickBrandingName}
                    onChange={(e) => setQuickBrandingName(e.target.value)}
                    placeholder="Branding profile name"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleQuickBrandingSetup}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowQuickBranding(false)}
                      className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="branding" className="block text-sm font-medium text-gray-700">
                Branding Profile
              </label>
              <select
                id="branding"
                value={brandingProfileId}
                onChange={(e) => setBrandingProfileId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">No branding (plain report)</option>
                {brandingProfiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} {profile.is_default && '(Default)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Weather Conditions - Simplified */}
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <Cloud className="h-5 w-5 text-gray-400 mr-2" />
                    <h2 className="text-lg font-medium text-gray-900">Inspection Conditions</h2>
                    <HelpIcon
                      title="Weather Documentation"
                      content="Document the environmental conditions during inspection."
                      bullets={[
                        "Important for compliance and liability",
                        "Helps explain certain observations",
                        "Weather can affect pipe conditions",
                        "Include temperature, recent weather patterns",
                        "Required by many inspection standards"
                      ]}
                      size="sm"
                      className="ml-2"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="weather" className="block text-sm font-medium text-gray-700">
                        Weather Conditions
                      </label>
                      <HelpIcon
                        title="Weather Conditions"
                        content="Comprehensive weather information for the inspection."
                        bullets={[
                          "Include current weather (e.g., 'Clear', 'Overcast', 'Light rain')",
                          "Add temperature with units (e.g., '22°C')",
                          "Note recent weather patterns (e.g., 'Dry for 7 days')",
                          "Example: 'Clear, sunny, 22°C. Dry conditions for past week.'"
                        ]}
                        size="sm"
                      />
                    </div>
                    <textarea
                      id="weather"
                      value={weatherConditions}
                      onChange={(e) => setWeatherConditions(e.target.value)}
                      placeholder="e.g., Clear, sunny, 22°C. Dry conditions for past week."
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Include current weather, temperature, and recent weather patterns
                    </p>
                  </div>
                </div>

        {/* Information Box - Updated */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
            <div className="ml-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-blue-800">What happens next?</h3>
                <HelpIcon
                  title="Report Generation Process"
                  content="Understanding the report creation workflow."
                  bullets={[
                    "Data snapshot is taken immediately",
                    "Comprehensive report with all sections",
                    "Report opens in editor for review",
                    "Add executive summary and recommendations",
                    "Preview and share once complete"
                  ]}
                  size="sm"
                />
              </div>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>A complete snapshot of your project data will be captured</li>
                  <li>A comprehensive report will be created in draft status</li>
                  <li>You can add executive summary and recommendations</li>
                  <li>Once finalized, the report becomes read-only</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">Error: {error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end items-center space-x-3">
          <Link
            href={`/projects/${projectId}/reports`}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </button>
          <HelpIcon
            title="Generate Report"
            content="Start the report generation process."
            bullets={[
              "Takes 5-10 seconds to complete",
              "All current data will be included",
              "Cannot be cancelled once started",
              "Report can be edited after generation"
            ]}
            size="sm"
          />
        </div>
      </form>
    </div>
  )
}