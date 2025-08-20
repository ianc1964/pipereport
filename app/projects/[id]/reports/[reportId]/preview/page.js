// app/projects/[id]/reports/[reportId]/preview/page.js
// Report Preview - Shows EXACTLY how the report will look when shared

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Share2, Download } from 'lucide-react'
import { getReport } from '@/lib/reports'

// Import all the same components used in the shared report viewer
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

export default function ReportPreviewPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id
  const reportId = params.reportId
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)
  const [expandedSections, setExpandedSections] = useState({
    methodology: false,
    limitations: false
  })

  useEffect(() => {
    loadReport()
  }, [reportId])

  const loadReport = async () => {
    try {
      setLoading(true)
      const reportData = await getReport(reportId)
      
      // Verify report belongs to this project
      if (reportData.project_id !== projectId) {
        throw new Error('Report does not belong to this project')
      }
      
      setReport(reportData)
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
    // Add a small delay to ensure all print styles are applied
    setTimeout(() => {
      window.print()
    }, 100)
  }

  if (loading) {
    return <LoadingState message="Loading report preview..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <Link 
                href={`/projects/${projectId}/reports`}
                className="text-gray-500 hover:text-gray-700 mr-4"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="text-gray-900">Back to Reports</span>
            </div>
          </div>
        </div>
        <ErrorState title="Unable to Load Report" message={error} />
      </div>
    )
  }

  if (!report) return null

  const branding = report.branding_profile || {}
  const projectData = report.project_snapshot || {}
  const stats = report.stats || {}
  const sections = report.sections_snapshot || []
  const observations = report.observations_snapshot || []

  // Apply branding colors (same as shared report)
  const brandingStyles = {
    '--primary-color': branding.primary_color || '#1e40af',
    '--secondary-color': branding.secondary_color || '#3b82f6',
    '--accent-color': branding.accent_color || '#f59e0b'
  }

  // Create a mock shareSettings object for the preview
  // (since preview should show how it will look when shared)
  const mockShareSettings = {
    allow_download: true,
    allow_print: true,
    watermark_enabled: false,
    watermark_text: 'CONFIDENTIAL'
  }

  return (
    <div className="min-h-screen bg-gray-50" style={brandingStyles}>
      {/* Preview Control Bar - Only visible in preview mode */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href={`/projects/${projectId}/reports/${reportId}`}
                className="text-gray-500 hover:text-gray-700 mr-4"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <p className="font-medium text-gray-900">Report Preview</p>
                <p className="text-xs text-gray-500">This is how your report will appear when shared</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrint}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Print Preview
              </button>
              
              {report.share_token && (
                <Link
                  href={`/reports/${report.share_token}`}
                  target="_blank"
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Share2 className="h-4 w-4 mr-1.5" />
                  View Shared
                </Link>
              )}
              
              <Link
                href={`/projects/${projectId}/reports/${reportId}`}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                <Edit className="h-4 w-4 mr-1.5" />
                Back to Editor
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Watermark for preview */}
      <Watermark 
        enabled={false} // You can enable this to show how watermark would look
        text={'PREVIEW'} 
      />
      
      {/* Print Header - will appear on every printed page */}
      <PrintHeader report={report} branding={branding} />
      
      {/* Screen Header - hidden when printing (same as shared report) */}
      <div className="no-print">
        <ReportHeader 
          report={report}
          branding={branding}
          shareSettings={mockShareSettings}
          onPrint={handlePrint}
        />
      </div>

      {/* Main Report Content - EXACTLY THE SAME AS SHARED REPORT */}
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

      {/* Report Footer - same as shared report */}
      <ReportFooter 
        report={report}
        branding={branding}
      />

      {/* Print Styles - same as shared report */}
      <PrintStyles expandedSections={expandedSections} />
    </div>
  )
}