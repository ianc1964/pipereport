// components/reports/DetailedFindingsSection.js
'use client'

import EnhancedDetailedFindings from '@/components/reports/EnhancedDetailedFindings'

export default function DetailedFindingsSection({ sections, observations }) {
  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Detailed Findings</h2>
      
      {sections.length === 0 ? (
        <p className="text-gray-600">No sections found in this report.</p>
      ) : (
        <EnhancedDetailedFindings 
          sections={sections} 
          observations={observations}
        />
      )}
    </section>
  )
}