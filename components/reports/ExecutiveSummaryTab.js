// components/reports/ExecutiveSummaryTab.js
// Executive Summary editor with key metrics display

import { useState, useEffect } from 'react'
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Activity,
  TrendingUp,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react'
import GenerateSummaryButton from './GenerateSummaryButton'

// Default templates
const DEFAULT_METHODOLOGY = `CCTV Drainage Survey Methodology

Inspection Standards
This survey was conducted in accordance with EN 13508-2 and WRc's Manual of Sewer Condition Classification (MSCC) standards, using industry-approved equipment and procedures.

Survey Procedure

Pre-Inspection
- Comprehensive high-pressure water jetting (120-150 bar) to remove debris and ensure clear visibility. (Where required or requested).
- Equipment calibration and distance counter zeroing at start reference point
- Site safety assessment including confined space procedures and gas monitoring

CCTV Inspection
- Pan/tilt/zoom or coiler camera system with minimum 1000 lumen lighting
- Maximum traverse speed of 0.2 m/s for detailed observation
- Digital recording at minimum 720p resolution with real-time monitoring

Data Recording
- Standardized defect coding using EN 13508-2 classification system (basic base codes)
- Clock position references (12 o'clock = top of pipe)
- Precise distance measurements from start point (±0.5% accuracy)
- High-resolution still images captured for all significant observations
- Severity grading scale 1-5 (1=minimal, 5=critical requiring immediate action)

Quality Assurance
- 100% inspection coverage of accessible pipeline sections
- Re-inspection of areas with initial poor visibility
- Cross-verification of observations against video timestamps
- Independent review of severity gradings for consistency

Survey Limitations
- Inspection limited to accessible sections from available access points
- Assessment based solely on visible internal pipe conditions
- Heavily surcharged sections may require repeat inspection
- Does not include hydraulic capacity or flow analysis
- Small diameter connections (<150mm) may have restricted visibility

Health & Safety Compliance
All work conducted in accordance with HSE Confined Spaces Regulations, where required, including continuous gas monitoring (H₂S, CH₄, O₂, CO), appropriate PPE, and emergency procedures.`

const DEFAULT_LIMITATIONS = `This report is based on a visual inspection of accessible drainage infrastructure only. The following limitations apply:

• Assessment limited to internally visible defects only
• Structural integrity cannot be fully determined without invasive investigation
• Pipe capacity and hydraulic performance not assessed
• Inaccessible sections not inspected
• A CCTV inspection does not necessarily clarify water tightness condition
• Conditions may have changed since the inspection date
• Recommendations based on visible evidence at time of survey

This report is confidential and prepared solely for the use of the client. No liability is accepted for third-party use without written permission.`

export default function ExecutiveSummaryTab({ report, updateReport, isReadOnly }) {
  const [summary, setSummary] = useState(report.executive_summary || '')
  const [methodology, setMethodology] = useState(report.methodology || '')
  const [limitations, setLimitations] = useState(report.limitations || '')
  const [expandedSections, setExpandedSections] = useState({
    methodology: false,
    limitations: false
  })
  
  // Calculate key metrics from the snapshot data
  const stats = report.stats || {}
  const observations = report.observations_snapshot || []
  const sections = report.sections_snapshot || []
  
  // Calculate total length dynamically (same logic as preview)
  const calculateTotalLength = () => {
    console.log('ExecutiveSummaryTab - Calculating total length...', { sections, observations })
    
    let totalLength = 0
    
    sections.forEach((section, index) => {
      // Try different possible field names for section ID
      const sectionId = section.id || section.section_id
      
      // Filter observations for this section
      const sectionObs = observations.filter(obs => {
        // Try different possible field names for section reference
        return obs.section_id === sectionId || 
               obs.sectionId === sectionId ||
               obs.section === sectionId
      })
      
      console.log(`ExecutiveSummaryTab - Section ${index + 1} (ID: ${sectionId}):`, {
        section,
        matchingObservations: sectionObs.length,
        sampleObs: sectionObs.slice(0, 2)
      })
      
      if (sectionObs.length === 0) {
        console.log(`ExecutiveSummaryTab - No observations found for section ${sectionId}`)
        return
      }
      
      // Get all distances and filter out null/undefined values
      const distances = sectionObs
        .map(obs => {
          // Try different possible field names for distance
          return obs.distance || obs.Distance || obs.chainage || obs.Chainage || 0
        })
        .filter(distance => distance !== null && distance !== undefined && !isNaN(distance))
      
      console.log(`ExecutiveSummaryTab - Section ${sectionId} distances:`, distances)
      
      if (distances.length === 0) {
        console.log(`ExecutiveSummaryTab - No valid distances found for section ${sectionId}`)
        return
      }
      
      const maxDistance = Math.max(...distances)
      console.log(`ExecutiveSummaryTab - Section ${sectionId} max distance (FINISH):`, maxDistance)
      
      totalLength += maxDistance
    })
    
    console.log('ExecutiveSummaryTab - Final total length:', totalLength)
    return totalLength
  }
  
  // Calculate completion percentage (sections with observations / total sections)
  const sectionsWithObservations = new Set(observations.map(o => o.section_id)).size
  const completionPercentage = sections.length > 0 
    ? Math.round((sectionsWithObservations / sections.length) * 100)
    : 0

  // Calculate total length dynamically
  const totalLength = calculateTotalLength()
  
  // Filter observations to get only critical ones (severity 4-5)
  const criticalObservations = observations.filter(obs => obs.severity >= 4)
  
  // Calculate severity distribution directly from observations (traffic light system)
  const calculateSeverityDistribution = () => {
    const counts = { high: 0, medium: 0, low: 0 }
    
    observations.forEach(obs => {
      if (obs.severity >= 4) {
        counts.high++
      } else if (obs.severity === 3) {
        counts.medium++
      } else if (obs.severity >= 1) {
        counts.low++
      }
    })
    
    return counts
  }
  
  const severityDistribution = calculateSeverityDistribution()
  
  // Calculate total observations with severity (for percentage calculations)
  const totalObservationsWithSeverity = severityDistribution.high + severityDistribution.medium + severityDistribution.low

  const handleSummaryChange = (value) => {
    setSummary(value)
    updateReport('executive_summary', value)
  }

  const handleAIGeneratedSummary = (generatedSummary) => {
    console.log('🤖 Applying AI-generated summary:', generatedSummary.substring(0, 100) + '...')
    handleSummaryChange(generatedSummary)
  }

  const handleMethodologyChange = (value) => {
    setMethodology(value)
    updateReport('methodology', value)
  }

  const handleLimitationsChange = (value) => {
    setLimitations(value)
    updateReport('limitations', value)
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <div className="p-6">
      {/* Key Metrics Dashboard */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Key Inspection Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Observations */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Observations</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total_observations || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          
          {/* Critical Issues */}
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Critical Issues</p>
                <p className="text-2xl font-semibold text-red-700">{severityDistribution.high}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          
          {/* Completion Rate */}
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Completion</p>
                <p className="text-2xl font-semibold text-green-700">{completionPercentage}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>
          
          {/* Total Length - Now using dynamic calculation */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600">Total Length</p>
                <p className="text-2xl font-semibold text-blue-700">{Math.round(totalLength * 10) / 10}m</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-400" />
            </div>
          </div>
        </div>
        
        {/* Severity Distribution */}
        <div className="mt-4 bg-white border rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Observation Severity Distribution</h4>
          <div className="space-y-2">
            {[
              { label: 'High (4-5)', count: severityDistribution.high, color: 'bg-red-500' },
              { label: 'Medium (3)', count: severityDistribution.medium, color: 'bg-yellow-500' },
              { label: 'Low (1-2)', count: severityDistribution.low, color: 'bg-green-500' }
            ].map((item) => (
              <div key={item.label} className="flex items-center">
                <span className="text-sm text-gray-600 w-20">{item.label}</span>
                <div className="flex-1 ml-2">
                  <div className="bg-gray-200 rounded-full h-4 relative">
                    <div 
                      className={`${item.color} rounded-full h-4 absolute top-0 left-0`}
                      style={{ 
                        width: `${totalObservationsWithSeverity > 0 ? (item.count / totalObservationsWithSeverity) * 100 : 0}%` 
                      }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-700 ml-2 w-10 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* UPDATED: Executive Summary Editor with AI Integration */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Executive Summary</h3>
                <div className="flex items-center gap-4">
                  {/* AI Generate Button - only show if not read-only */}
                  {!isReadOnly && (
                    <GenerateSummaryButton
                      report={report}
                      onSummaryGenerated={handleAIGeneratedSummary}
                      disabled={isReadOnly}
                      currentSummary={summary}
                    />
                  )}
                  <span className="text-sm text-gray-500">
                    {summary.length} characters
                  </span>
                </div>
              </div>
        
        {isReadOnly ? (
          <div className="prose max-w-none bg-gray-50 rounded-lg p-4">
            {summary || <span className="text-gray-500 italic">No executive summary provided.</span>}
          </div>
        ) : (
          <>
            <textarea
              value={summary}
              onChange={(e) => handleSummaryChange(e.target.value)}
              placeholder="Provide a high-level overview of the inspection findings, overall condition assessment, and key recommendations..."
              className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-2 text-sm text-gray-500">
              <Info className="inline h-4 w-4 mr-1" />
              Tips: Summarize the overall condition, highlight critical findings, and provide clear next steps.
            </div>
          </>
        )}
      </div>

      {/* Methodology Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Inspection Methodology</h3>
          {!isReadOnly && (
            <div className="flex items-center space-x-2">
              {methodology !== DEFAULT_METHODOLOGY && (
                <button
                  onClick={() => {
                    if (window.confirm('Reset to default CCTV methodology template? This will replace your current text.')) {
                      handleMethodologyChange(DEFAULT_METHODOLOGY)
                    }
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  title="Reset to default template"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reset to Default
                </button>
              )}
              <button
                onClick={() => toggleSection('methodology')}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200"
              >
                {expandedSections.methodology ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Expand
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        
        {isReadOnly ? (
          <div className="prose max-w-none bg-gray-50 rounded-lg p-4">
            <div className="whitespace-pre-wrap text-sm">
              {methodology || <span className="text-gray-500 italic">No methodology specified.</span>}
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={methodology}
              onChange={(e) => handleMethodologyChange(e.target.value)}
              placeholder="Describe the inspection methodology, equipment used, standards followed..."
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm transition-all duration-300 ${
                expandedSections.methodology ? 'h-96' : 'h-32'
              }`}
              style={{ resize: 'vertical' }}
            />
            {!methodology && (
              <div className="mt-2 flex items-start space-x-2 text-sm text-blue-600">
                <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>A standard CCTV inspection methodology template has been provided. You can edit it to match your specific survey.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Limitations Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Limitations & Disclaimers</h3>
          {!isReadOnly && (
            <div className="flex items-center space-x-2">
              {limitations !== DEFAULT_LIMITATIONS && (
                <button
                  onClick={() => {
                    if (window.confirm('Reset to default limitations template? This will replace your current text.')) {
                      handleLimitationsChange(DEFAULT_LIMITATIONS)
                    }
                  }}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  title="Reset to default template"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reset to Default
                </button>
              )}
              <button
                onClick={() => toggleSection('limitations')}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200"
              >
                {expandedSections.limitations ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Expand
                  </>
                )}
              </button>
            </div>
          )}
        </div>
        
        {isReadOnly ? (
          <div className="prose max-w-none bg-gray-50 rounded-lg p-4">
            <div className="whitespace-pre-wrap text-sm">
              {limitations || <span className="text-gray-500 italic">No limitations specified.</span>}
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={limitations}
              onChange={(e) => handleLimitationsChange(e.target.value)}
              placeholder="Note any limitations of the inspection, areas not accessed, weather conditions affecting visibility..."
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm transition-all duration-300 ${
                expandedSections.limitations ? 'h-48' : 'h-32'
              }`}
              style={{ resize: 'vertical' }}
            />
            {!limitations && (
              <div className="mt-2 flex items-start space-x-2 text-sm text-blue-600">
                <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>A standard limitations template has been provided. Customize it based on your specific survey conditions.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Insights */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800">Quick Insights</h4>
            <ul className="mt-2 text-sm text-yellow-700 space-y-1">
              {severityDistribution.high > 0 && (
                <li>• {severityDistribution.high} critical issue{severityDistribution.high > 1 ? 's' : ''} requiring immediate attention (severity 4-5)</li>
              )}
              {completionPercentage < 100 && (
                <li>• {sections.length - sectionsWithObservations} section{sections.length - sectionsWithObservations > 1 ? 's' : ''} without observations</li>
              )}
              {getSectionsWithCriticalDefects(observations, sections).count > 0 && (
                <li>• {getSectionsWithCriticalDefects(observations, sections).count} section{getSectionsWithCriticalDefects(observations, sections).count > 1 ? 's' : ''} with critical defects</li>
              )}
              {getMostSeriousDefect(observations) && (
                <li>• Most serious defect: {getMostSeriousDefect(observations)}</li>
              )}
              {totalLength > 0 && stats.total_observations && (
                <li>• Average of {(stats.total_observations / totalLength).toFixed(2)} observations per meter</li>
              )}
              {getMostCommonCriticalIssue(criticalObservations) && (
                <li>• Most common critical issue: {getMostCommonCriticalIssue(criticalObservations)}</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to find sections with critical defects (severity 4-5)
function getSectionsWithCriticalDefects(observations, sections) {
  const sectionsWithCritical = new Set()
  
  observations.forEach(obs => {
    if (obs.severity >= 4 && obs.section_id) {
      sectionsWithCritical.add(obs.section_id)
    }
  })
  
  return {
    count: sectionsWithCritical.size,
    sections: Array.from(sectionsWithCritical)
  }
}

// Helper function to find the most serious defect
function getMostSeriousDefect(observations) {
  if (observations.length === 0) return null
  
  // Find the highest severity
  const maxSeverity = Math.max(...observations.map(obs => obs.severity || 0))
  
  if (maxSeverity === 0) return null
  
  // Find the first observation with that severity
  const mostSerious = observations.find(obs => obs.severity === maxSeverity)
  
  if (!mostSerious) return null
  
  // Return description with severity
  return `${mostSerious.description || mostSerious.code || 'Unknown'} (Severity ${maxSeverity})`
}

// Helper function to find most common issue among critical observations (severity 4-5)
function getMostCommonCriticalIssue(criticalObservations) {
  if (criticalObservations.length === 0) return null
  
  // Group by issue type and calculate frequency
  const issueCounts = {}
  
  criticalObservations.forEach(obs => {
    if (obs.code && obs.description) {
      const issueKey = obs.description
      if (!issueCounts[issueKey]) {
        issueCounts[issueKey] = {
          description: obs.description,
          code: obs.code,
          count: 0,
          maxSeverity: obs.severity
        }
      }
      issueCounts[issueKey].count++
      // Track the highest severity for this issue type
      if (obs.severity > issueCounts[issueKey].maxSeverity) {
        issueCounts[issueKey].maxSeverity = obs.severity
      }
    }
  })
  
  // Find the most common critical issue
  let maxCount = 0
  let mostCommonIssue = null
  
  Object.values(issueCounts).forEach((issue) => {
    if (issue.count > maxCount) {
      maxCount = issue.count
      mostCommonIssue = issue
    }
  })
  
  if (!mostCommonIssue || mostCommonIssue.count === 1) {
    // Don't show if there's only 1 occurrence or no common pattern
    return null
  }
  
  // Return description with code and count
  return `${mostCommonIssue.description} (${mostCommonIssue.code}) - ${mostCommonIssue.count} occurrences`
}