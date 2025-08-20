// lib/utils/observation-filter.js
// Utility functions for filtering observations and determining what constitutes an actual issue

/**
 * DRAINAGE INSPECTION OBSERVATION CLASSIFICATION:
 * 
 * 1. INFORMATIONAL OBSERVATIONS (Never issues):
 *    - Line Deviations: LD, LU, LL, LR
 *    - Infrastructure: JN (Junctions), CN (Connections)
 *    - Markers: START, FINISH
 *    - Changes: SC (Shape), LC (Lining)
 *    - Notes: REM (General Remarks)
 * 
 * 2. SPECIAL CASE - Water Levels (WL):
 *    - Usually informational
 *    - Becomes an issue if: has severity OR percentage > 20%
 * 
 * 3. ACTUAL ISSUES (Require severity > 0):
 *    - Defects, damages, structural problems
 *    - Everything else with a severity rating
 */

// Define observation types that are NEVER issues (informational only)
const INFORMATIONAL_CODES = [
  'LD', 'LU', 'LL', 'LR',  // Line Deviations
  'JN',                     // Junctions
  'CN',                     // Connections
  'START', 'FINISH',        // Start/Finish markers
  'SC',                     // Shape Change
  'LC',                     // Lining Change
  'REM'                     // General Remark
]

/**
 * Determine if an observation is an actual issue requiring attention
 * @param {Object} obs - The observation object
 * @returns {boolean} - True if this is an actual issue, false if informational
 */
export function isActualIssue(obs) {
  const code = obs.code?.toUpperCase() || ''
  
  // 1. Never treat informational codes as issues
  if (INFORMATIONAL_CODES.includes(code)) {
    return false
  }
  
  // 2. Special case: Water Levels (WL)
  if (code === 'WL') {
    // WL is an issue if it has severity OR is over 20%
    const hasSeverity = obs.severity !== null && 
                       obs.severity !== undefined && 
                       !isNaN(obs.severity) && 
                       obs.severity > 0
    
    if (hasSeverity) return true
    
    // Check if water level percentage is over 20%
    const description = obs.description || ''
    const percentMatch = description.match(/(\d+(?:\.\d+)?)%/)
    if (percentMatch) {
      const percentage = parseFloat(percentMatch[1])
      return percentage > 20
    }
    
    return false
  }
  
  // 3. All other observations: only issues if they have severity
  return obs.severity !== null && 
         obs.severity !== undefined && 
         !isNaN(obs.severity) && 
         obs.severity > 0
}

/**
 * Filter report data to only include actual issues, not informational observations
 * CRITICAL: This function should be used before sending to AI summary generation
 * IMPORTANT: Provides context about inspection completeness even when no issues found
 * @param {Object} report - The report object with observations_snapshot
 * @returns {Object} - Filtered report with only actual issues + inspection context
 */
export function filterReportForAIAnalysis(report) {
  if (!report || !report.observations_snapshot) {
    return report
  }

  const allObservations = report.observations_snapshot
  const actualIssues = allObservations.filter(isActualIssue)
  const informationalObs = allObservations.filter(obs => !isActualIssue(obs))
  const sections = report.sections_snapshot || []

  // Calculate TRUE completion rate based on sections that had ANY observations
  const sectionsWithAnyObservations = new Set(allObservations.map(o => o.section_id)).size
  const actualCompletionRate = sections.length > 0 ? 
    Math.round((sectionsWithAnyObservations / sections.length) * 100) : 0

  // Categorize informational observations for context
  const informationalBreakdown = {}
  informationalObs.forEach(obs => {
    const code = obs.code?.toUpperCase() || 'UNKNOWN'
    informationalBreakdown[code] = (informationalBreakdown[code] || 0) + 1
  })

  console.log(`🔍 Filtered observations: ${actualIssues.length} issues (from ${allObservations.length} total observations)`)
  console.log(`📊 Inspection context: ${sectionsWithAnyObservations}/${sections.length} sections inspected (${actualCompletionRate}% complete)`)
  console.log(`ℹ️ Informational observations: ${informationalObs.length} (${Object.keys(informationalBreakdown).join(', ')})`)

  return {
    ...report,
    observations_snapshot: actualIssues,
    stats: {
      ...report.stats,
      // Issue-specific stats
      total_observations: actualIssues.length,
      total_issues: actualIssues.length,
      critical_issues: actualIssues.filter(obs => obs.severity >= 4).length,
      high_issues: actualIssues.filter(obs => obs.severity === 3).length,
      medium_issues: actualIssues.filter(obs => obs.severity === 2).length,
      low_issues: actualIssues.filter(obs => obs.severity === 1).length,
      
      // CRITICAL: Inspection completeness context
      original_total_observations: allObservations.length,
      informational_observations: informationalObs.length,
      actual_completion_rate: actualCompletionRate,
      sections_with_any_observations: sectionsWithAnyObservations,
      total_sections: sections.length,
      
      // Informational breakdown for AI context
      informational_breakdown: informationalBreakdown,
      
      // Inspection quality indicators
      inspection_quality: {
        data_collected: allObservations.length > 0,
        sections_covered: sectionsWithAnyObservations,
        has_informational_data: informationalObs.length > 0,
        has_structural_issues: actualIssues.length > 0,
        condition_assessment: actualIssues.length === 0 && informationalObs.length > 0 ? 'good' : 
                             actualIssues.length > 0 ? 'issues_found' : 'incomplete'
      }
    }
  }
}

/**
 * Get a summary of observation types for debugging/verification
 * @param {Array} observations - Array of observation objects
 * @returns {Object} - Summary with counts by type and code
 */
export function getObservationTypesSummary(observations) {
  const summary = {
    total: observations.length,
    informational: 0,
    issues: 0,
    byCode: {}
  }

  observations.forEach(obs => {
    const code = obs.code?.toUpperCase() || 'UNKNOWN'
    
    if (!summary.byCode[code]) {
      summary.byCode[code] = { count: 0, isIssue: false }
    }
    summary.byCode[code].count++
    
    if (isActualIssue(obs)) {
      summary.issues++
      summary.byCode[code].isIssue = true
    } else {
      summary.informational++
    }
  })

  return summary
}