// components/reports/InspectionSummary.js
'use client'

import { getTrafficLightColor, getTrafficLightGroup } from '@/lib/utils/severityUtils'

export default function InspectionSummary({ stats = {}, sections = [], observations = [] }) {
  // Calculate total length as sum of highest distances per section
  const calculateTotalLength = () => {
    console.log('Calculating total length...', { sections, observations })
    
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
      
      console.log(`Section ${index + 1} (ID: ${sectionId}):`, {
        section,
        matchingObservations: sectionObs.length,
        sampleObs: sectionObs.slice(0, 2)
      })
      
      if (sectionObs.length === 0) {
        console.log(`No observations found for section ${sectionId}`)
        return
      }
      
      // Get all distances and filter out null/undefined values
      const distances = sectionObs
        .map(obs => {
          // Try different possible field names for distance
          return obs.distance || obs.Distance || obs.chainage || obs.Chainage || 0
        })
        .filter(distance => distance !== null && distance !== undefined && !isNaN(distance))
      
      console.log(`Section ${sectionId} distances:`, distances)
      
      if (distances.length === 0) {
        console.log(`No valid distances found for section ${sectionId}`)
        return
      }
      
      const maxDistance = Math.max(...distances)
      console.log(`Section ${sectionId} max distance (FINISH):`, maxDistance)
      
      totalLength += maxDistance
    })
    
    console.log('Final total length:', totalLength)
    return totalLength
  }

  // Calculate traffic light distribution
  const calculateTrafficLightDistribution = () => {
    const trafficLightCounts = { Low: 0, Medium: 0, High: 0 }
    observations.forEach(obs => {
      const group = getTrafficLightGroup(obs.severity)
      if (group) trafficLightCounts[group]++
    })
    
    const totalObs = Object.values(trafficLightCounts).reduce((sum, count) => sum + count, 0)
    
    return {
      counts: trafficLightCounts,
      total: totalObs,
      percentages: {
        Low: totalObs > 0 ? (trafficLightCounts.Low / totalObs) * 100 : 0,
        Medium: totalObs > 0 ? (trafficLightCounts.Medium / totalObs) * 100 : 0,
        High: totalObs > 0 ? (trafficLightCounts.High / totalObs) * 100 : 0
      }
    }
  }

  const totalLength = calculateTotalLength()
  const distribution = calculateTrafficLightDistribution()

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Inspection Summary</h2>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{stats.total_observations || 0}</div>
          <div className="text-sm text-gray-600">Total Observations</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-600">{stats.critical_observations || 0}</div>
          <div className="text-sm text-gray-600">Critical Issues</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{stats.total_sections || 0}</div>
          <div className="text-sm text-gray-600">Sections Inspected</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900">{Math.round(totalLength * 10) / 10}m</div>
          <div className="text-sm text-gray-600">Total Length</div>
        </div>
      </div>

      {/* Traffic Light Severity Distribution */}
      {distribution.total > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Severity Distribution</h3>
          <div className="space-y-2">
            {[
              { key: 'Low', label: 'Low (Severity 1-2)', count: distribution.counts.Low },
              { key: 'Medium', label: 'Medium (Severity 3)', count: distribution.counts.Medium },
              { key: 'High', label: 'High (Severity 4-5)', count: distribution.counts.High }
            ].map(({ key, label, count }) => {
              const percentage = distribution.percentages[key]
              
              return (
                <div key={key} className="flex items-center">
                  <div className="w-24 text-sm text-gray-600">{label}</div>
                  <div className="flex-1 mx-2">
                    <div className="bg-gray-200 rounded-full h-6 relative overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: getTrafficLightColor(key)
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-12 text-sm text-gray-700 text-right">{count}</div>
                </div>
              )
            })}
          </div>
          
          {/* Summary Stats */}
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold" style={{ color: getTrafficLightColor('Low') }}>
                {distribution.percentages.Low.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600">Low Risk</div>
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: getTrafficLightColor('Medium') }}>
                {distribution.percentages.Medium.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600">Medium Risk</div>
            </div>
            <div>
              <div className="text-lg font-semibold" style={{ color: getTrafficLightColor('High') }}>
                {distribution.percentages.High.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600">High Risk</div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}