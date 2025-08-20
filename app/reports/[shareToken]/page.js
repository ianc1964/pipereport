// app/reports/[shareToken]/page.js
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { getReportByShareToken } from '@/lib/reports'
import ProjectOverview from '@/components/reports/ProjectOverview'
import ReportHeader from '@/components/reports/ReportHeader'
import ReportFooter from '@/components/reports/ReportFooter'
import CollapsibleSection from '@/components/reports/CollapsibleSection'
import LoadingState from '@/components/reports/LoadingState'
import ErrorState from '@/components/reports/ErrorState'
import ExecutiveSummary from '@/components/reports/ExecutiveSummary'
import InspectionSummary from '@/components/reports/InspectionSummary'
import DetailedFindingsSection from '@/components/reports/DetailedFindingsSection'
import MapSnapshotsSection from '@/components/reports/MapSnapshotsSection'
import RecommendationsSection from '@/components/reports/RecommendationsSection'
import Watermark from '@/components/reports/Watermark'
import PrintStyles from '@/components/reports/PrintStyles'
import TableOfContents from '@/components/reports/TableOfContents'
import DefectGuide from '@/components/reports/DefectGuide'
import PrintHeader from '@/components/reports/PrintHeader'

export default function PublicReportViewer() {
  const params = useParams()
  const shareToken = params.shareToken
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [shareSettings, setShareSettings] = useState(null)
  const [expandedSections, setExpandedSections] = useState({
    methodology: false,
    limitations: false
  })

  useEffect(() => {
    loadReport()
  }, [shareToken])

  const loadReport = async () => {
    try {
      setLoading(true)
      const { report: reportData, share } = await getReportByShareToken(shareToken)
      setReport(reportData)
      setShareSettings(share)
    } catch (error) {
      console.error('Error loading report:', error)
      setError(error.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const handlePrint = () => {
    if (!shareSettings?.allow_print) {
      alert('Printing is not allowed for this report')
      return
    }
    // Add a small delay to ensure all print styles are applied
    setTimeout(() => {
      window.print()
    }, 100)
  }

  if (loading) {
    return <LoadingState message="Loading report..." />
  }

  if (error) {
    return <ErrorState title="Unable to Load Report" message={error} />
  }

  if (!report) return null

  const branding = report.branding_profile || {}
  const projectData = report.project_snapshot || {}
  const stats = report.stats || {}
  const sections = report.sections_snapshot || []
  const observations = report.observations_snapshot || []

  // Apply branding colors
  const brandingStyles = {
    '--primary-color': branding.primary_color || '#1e40af',
    '--secondary-color': branding.secondary_color || '#3b82f6',
    '--accent-color': branding.accent_color || '#f59e0b'
  }

  return (
    <div className="min-h-screen bg-gray-50" style={brandingStyles}>
      <Watermark 
        enabled={shareSettings?.watermark_enabled} 
        text={shareSettings?.watermark_text || 'CONFIDENTIAL'} 
      />
      
      {/* Print Header - will appear on every printed page */}
      <PrintHeader report={report} branding={branding} />
      
      {/* Screen Header - hidden when printing */}
      <div className="no-print">
        <ReportHeader 
          report={report}
          branding={branding}
          shareSettings={shareSettings}
          onPrint={handlePrint}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Table of Contents - only shows when printing */}
        <TableOfContents 
          sections={sections}
          hasExecutiveSummary={!!report.executive_summary}
          hasRecommendations={!!report.recommendations?.length}
          hasMapSnapshots={!!report.map_snapshots?.length}
        />

        {/* Project Overview with print class */}
        <div className="report-section" id="project-overview">
          <ProjectOverview 
            projectData={projectData}
            report={report}
          />
        </div>

        {/* Executive Summary with print class */}
        {report.executive_summary && (
          <div className="report-section executive-summary" id="executive-summary">
            <ExecutiveSummary summary={report.executive_summary} report={report} />
          </div>
        )}

        {/* Inspection Summary with print class */}
        <div className="report-section inspection-summary" id="inspection-summary">
          <InspectionSummary 
            stats={stats}
            sections={sections}
            observations={observations}
          />
        </div>

        {/* Detailed Findings with print class */}
        <div className="report-section detailed-findings" id="detailed-findings">
          <DetailedFindingsSection 
            sections={sections} 
            observations={observations}
          />
        </div>

        {/* Map Snapshots with print class */}
        {report.map_snapshots?.length > 0 && (
          <div className="report-section map-snapshots" id="map-snapshots">
            <MapSnapshotsSection mapSnapshots={report.map_snapshots} />
          </div>
        )}

        {/* Recommendations with print class */}
        {report.recommendations?.length > 0 && (
          <div className="report-section recommendations-section" id="recommendations">
            <RecommendationsSection recommendations={report.recommendations} />
          </div>
        )}

        {/* Defect Guide - only shows when printing */}
        <DefectGuide />

        {/* Methodology with print class */}
        <div className="report-section methodology-section" id="methodology">
          <CollapsibleSection
            title="Methodology"
            content={report.methodology}
            isExpanded={expandedSections.methodology}
            onToggle={() => toggleSection('methodology')}
            printExpanded={true}
          />
        </div>

        {/* Limitations with print class */}
        <div className="report-section limitations-section" id="limitations">
          <CollapsibleSection
            title="Limitations & Disclaimers"
            content={report.limitations}
            isExpanded={expandedSections.limitations}
            onToggle={() => toggleSection('limitations')}
            printExpanded={true}
          />
        </div>
      </main>

      <ReportFooter 
        report={report}
        branding={branding}
      />

      <PrintStyles expandedSections={expandedSections} />
    </div>
  )
}