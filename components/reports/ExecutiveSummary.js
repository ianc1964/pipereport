// components/reports/ExecutiveSummary.js
'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { isActualIssue } from '@/lib/utils/observation-filter'

export default function ExecutiveSummary({ summary, report }) {
  if (!summary) {
    return null
  }

  // Extract data for Quick Insights
  const allObservations = report?.observations_snapshot || []
  const sections = report?.sections_snapshot || []
  const stats = report?.stats || {}
  
  // Apply sophisticated filtering: only actual issues, not informational observations
  const observations = allObservations.filter(isActualIssue)
  // Create a filtered report object for any analysis functions
  // This ensures AI and other analysis only see actual issues
  const filteredReport = {
    ...report,
    observations_snapshot: observations,
    // Update stats to reflect only actual issues
    stats: {
      ...stats,
      total_observations: observations.length,
      total_issues: observations.length
    }
  }
  
  // Calculate sections with actual issues for completion percentage
  const sectionsWithObservations = new Set(observations.map(o => o.section_id)).size
  const completionPercentage = sections.length > 0 
    ? Math.round((sectionsWithObservations / sections.length) * 100)
    : 0

  // Calculate total length dynamically (only from sections with actual issues)
  const calculateTotalLength = () => {
    let totalLength = 0
    
    sections.forEach((section) => {
      const sectionId = section.id || section.section_id
      const sectionObs = observations.filter(obs => {
        return obs.section_id === sectionId || 
               obs.sectionId === sectionId ||
               obs.section === sectionId
      })
      
      // Only count sections that have actual issues (observations with severity)
      if (sectionObs.length === 0) return
      
      const distances = sectionObs
        .map(obs => obs.distance || obs.Distance || obs.chainage || obs.Chainage || 0)
        .filter(distance => distance !== null && distance !== undefined && !isNaN(distance))
      
      if (distances.length === 0) return
      
      const maxDistance = Math.max(...distances)
      totalLength += maxDistance
    })
    
    return totalLength
  }

  const totalLength = calculateTotalLength()
  
  // Calculate critical issues (severity 4-5) directly from actual issues
  const criticalObservations = observations.filter(obs => obs.severity >= 4)
  const criticalCount = criticalObservations.length

  // Get informational context (junctions, connections, etc.) for additional insights
  const informationalObs = allObservations.filter(obs => !isActualIssue(obs))
  const junctionCount = informationalObs.filter(obs => obs.code?.toUpperCase() === 'JN').length
  const connectionCount = informationalObs.filter(obs => obs.code?.toUpperCase() === 'CN').length
  const waterLevelObs = allObservations.filter(obs => obs.code?.toUpperCase() === 'WL')
  const significantWaterLevels = waterLevelObs.filter(obs => {
    if (isActualIssue(obs)) return true // Already flagged as issue
    // Check for any water level mentions that might be noteworthy
    const description = obs.description || ''
    const percentMatch = description.match(/(\d+(?:\.\d+)?)%/)
    return percentMatch && parseFloat(percentMatch[1]) > 10 // Note levels over 10%
  })

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Executive Summary</h2>
      <div className="prose max-w-none mb-6">
        <div className="whitespace-pre-wrap text-gray-700">
          {formatSummaryText(summary)}
        </div>
      </div>

      {/* Quick Insights */}
      {observations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Key Inspection Insights</h4>
              <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                {criticalCount > 0 && (
                  <li>• {criticalCount} critical issue{criticalCount > 1 ? 's' : ''} requiring immediate attention (severity 4-5)</li>
                )}
                {completionPercentage < 100 && (
                  <li>• {sections.length - sectionsWithObservations} section{sections.length - sectionsWithObservations > 1 ? 's' : ''} without issues</li>
                )}
                {getSectionsWithCriticalDefects(observations, sections).count > 0 && (
                  <li>• {getSectionsWithCriticalDefects(observations, sections).count} section{getSectionsWithCriticalDefects(observations, sections).count > 1 ? 's' : ''} with critical defects</li>
                )}
                {getMostSeriousDefect(observations) && (
                  <li>• Most serious defect: {getMostSeriousDefect(observations)}</li>
                )}
                {totalLength > 0 && observations.length > 0 && (
                  <li>• Average of {(observations.length / totalLength).toFixed(2)} issues per meter</li>
                )}
                {getMostCommonCriticalIssue(criticalObservations) && (
                  <li>• Most common critical issue: {getMostCommonCriticalIssue(criticalObservations)}</li>
                )}
                {/* Informational context - not issues */}
                {junctionCount > 0 && (
                  <li>• {junctionCount} junction{junctionCount > 1 ? 's' : ''} documented</li>
                )}
                {connectionCount > 0 && (
                  <li>• {connectionCount} connection{connectionCount > 1 ? 's' : ''} documented</li>
                )}
                {significantWaterLevels.length > 0 && (
                  <li>• {significantWaterLevels.length} notable water level{significantWaterLevels.length > 1 ? 's' : ''} recorded</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Helper function to format summary text with bold formatting
function formatSummaryText(text) {
  if (!text) return null
  
  // Split text by double asterisks to find bold sections
  const parts = text.split(/(\*\*.*?\*\*)/g)
  
  return parts.map((part, index) => {
    // Check if this part is wrapped in double asterisks
    if (part.startsWith('**') && part.endsWith('**')) {
      // Remove the asterisks and make it bold
      const boldText = part.slice(2, -2)
      return (
        <strong key={index} className="font-semibold text-gray-900">
          {boldText}
        </strong>
      )
    }
    // Regular text part
    return part
  })
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
  
  // Observations are already filtered by isActualIssue, but ensure they have severity
  const validObservations = observations.filter(obs => 
    obs.severity !== null && 
    obs.severity !== undefined && 
    !isNaN(obs.severity) && 
    obs.severity > 0
  )
  
  if (validObservations.length === 0) return null
  
  // Find the highest severity
  const maxSeverity = Math.max(...validObservations.map(obs => obs.severity))
  
  // Find the first observation with that severity
  const mostSerious = validObservations.find(obs => obs.severity === maxSeverity)
  
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