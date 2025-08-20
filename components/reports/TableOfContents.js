// components/reports/TableOfContents.js
'use client'

export default function TableOfContents({ sections, hasExecutiveSummary, hasRecommendations, hasMapSnapshots }) {
  const tocEntries = [
    { title: 'Executive Summary', id: 'executive-summary', show: hasExecutiveSummary },
    { title: 'Project Overview', id: 'project-overview', show: true },
    { title: 'Inspection Summary', id: 'inspection-summary', show: true },
    { title: 'Detailed Findings', id: 'detailed-findings', show: true },
  ]

  // Add sections dynamically
  sections?.forEach((section, index) => {
    tocEntries.push({
      title: `Section ${section.section_number || index + 1}: ${section.name}`,
      id: `section-${section.id}`,
      show: true,
      indent: true
    })
  })

  // Add remaining sections
  tocEntries.push(
    { title: 'Maps & Site Diagrams', id: 'map-snapshots', show: hasMapSnapshots },
    { title: 'Recommendations', id: 'recommendations', show: hasRecommendations },
    { title: 'Guide to Defect Codes', id: 'defect-guide', show: true },
    { title: 'Inspection Methodology', id: 'methodology', show: true },
    { title: 'Limitations & Disclaimers', id: 'limitations', show: true }
  )

  return (
    <div className="table-of-contents print:block hidden" id="table-of-contents">
      <h1 className="text-3xl font-bold mb-8">Table of Contents</h1>
      
      <div className="space-y-3">
        {tocEntries.filter(entry => entry.show).map((entry, index) => (
          <div 
            key={entry.id} 
            className={`toc-entry ${entry.indent ? 'ml-6' : ''}`}
            data-page={index + 2} // Pages start from 2 after cover
          >
            <span className="toc-title text-base">
              {entry.title}
            </span>
            <span className="toc-dots"></span>
            <span className="toc-page text-base">
              {/* Page numbers will be filled by CSS */}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-12 text-sm text-gray-600">
        <p className="font-semibold">Report Reference:</p>
        <p>This document contains confidential information and is intended solely for the addressee.</p>
      </div>
    </div>
  )
}