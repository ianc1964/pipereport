// app/projects/[id]/reports/[reportId]/page.js
// Report Editor - Main page for editing draft reports with help icons

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, 
  ChevronLeft,
  Save,
  Eye,
  CheckCircle,
  AlertCircle,
  BookOpen,
  ClipboardList,
  Target,
  Settings,
  Calendar,
  User,
  Share2,
  Map,
  Image,
  Info
} from 'lucide-react'
import { getReport, updateReport, finalizeReport } from '../../../../../lib/reports'
import ExecutiveSummaryTab from '../../../../../components/reports/ExecutiveSummaryTab'
import FindingsTab from '../../../../../components/reports/FindingsTab'
import MapSnapshotsTab from '../../../../../components/reports/MapSnapshotsTab'
import RecommendationsTab from '../../../../../components/reports/RecommendationsTab'
import SettingsTab from '../../../../../components/reports/SettingsTab'
import HelpIcon from '@/components/help/HelpIcon'

export default function ReportEditorPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id
  const reportId = params.reportId
  
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  useEffect(() => {
    loadReport()
  }, [reportId])

  // Auto-save every 30 seconds if there are changes
  useEffect(() => {
    if (unsavedChanges && report?.status === 'draft') {
      const timer = setTimeout(() => {
        handleSave()
      }, 30000)
      return () => clearTimeout(timer)
    }
  }, [unsavedChanges, report])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [unsavedChanges])

  const loadReport = async () => {
    try {
      setLoading(true)
      const data = await getReport(reportId)
      setReport(data)
      
      // Check if report belongs to this project
      if (data.project_id !== projectId) {
        throw new Error('Report does not belong to this project')
      }
    } catch (err) {
      console.error('Error loading report:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
      if (report.status !== 'draft') return
      
      try {
        setSaving(true)
        await updateReport(reportId, {
          executive_summary: report.executive_summary,
          findings_summary: report.findings_summary,
          methodology: report.methodology,
          limitations: report.limitations,
          weather_conditions: report.weather_conditions,
          map_snapshots: report.map_snapshots
        })
        setUnsavedChanges(false)
        setLastSaved(new Date())
      } catch (err) {
        console.error('Error saving report:', err)
        alert('Failed to save report: ' + err.message)
      } finally {
        setSaving(false)
      }
    }

  const handleFinalize = async () => {
    if (unsavedChanges) {
      await handleSave()
    }
    
    if (!window.confirm('Are you sure you want to finalize this report? Once finalized, it cannot be edited.')) {
      return
    }
    
    try {
      await finalizeReport(reportId)
      router.push(`/projects/${projectId}/reports`)
    } catch (err) {
      console.error('Error finalizing report:', err)
      alert('Failed to finalize report: ' + err.message)
    }
  }

  const updateReportData = (field, value) => {
    setReport(prev => ({ ...prev, [field]: value }))
    setUnsavedChanges(true)
  }

  const tabs = [
    { 
      id: 'summary', 
      label: 'Executive Summary', 
      icon: BookOpen,
      help: {
        title: 'Executive Summary',
        content: 'Provide a high-level overview of the inspection findings.',
        bullets: [
          'Summarize key findings in 2-3 paragraphs',
          'Highlight critical issues requiring immediate attention',
          'Include overall condition assessment',
          'Written for management/non-technical audience',
          'Keep concise - typically 250-500 words'
        ]
      }
    },
    { 
      id: 'findings', 
      label: 'Findings Review', 
      icon: ClipboardList,
      help: {
        title: 'Findings Review',
        content: 'Review and verify all observations from the inspection.',
        bullets: [
          'Lists all documented observations',
          'Shows severity levels and locations',
          'Includes captured images and timestamps',
          'Can filter by severity or section',
          'Read-only - observations cannot be edited here'
        ]
      }
    },
    { 
      id: 'maps', 
      label: 'Maps & Drawings', 
      icon: Map,
      help: {
        title: 'Maps & Drawings',
        content: 'Include infrastructure maps and drawings in the report.',
        bullets: [
          'Capture current map state for report',
          'Add multiple map views if needed',
          'Maps show observation locations',
          'Include legend and scale',
          'Maps become static images in final report'
        ]
      }
    },
    { 
      id: 'recommendations', 
      label: 'Recommendations', 
      icon: Target,
      help: {
        title: 'Recommendations',
        content: 'Provide actionable recommendations based on findings.',
        bullets: [
          'Prioritize repairs and maintenance',
          'Include timeframes (immediate, short-term, long-term)',
          'Estimate costs if applicable',
          'Reference specific observations',
          'Be clear and actionable'
        ]
      }
    },
    { 
      id: 'settings', 
      label: 'Report Settings', 
      icon: Settings,
      help: {
        title: 'Report Settings',
        content: 'Configure report metadata and display options.',
        bullets: [
          'Update report title and number',
          'Modify weather conditions',
          'Select branding profile',
          'Configure what sections to include',
          'Set report template style'
        ]
      }
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Link href={`/projects/${projectId}/reports`} className="text-blue-600 hover:underline">
            Back to Reports
          </Link>
        </div>
      </div>
    )
  }

  const isReadOnly = report.status !== 'draft'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link 
                href={`/projects/${projectId}/reports`}
                className="text-gray-500 hover:text-gray-700 mr-4"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    {report.report_number}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {report.title}
                  </p>
                </div>
                <HelpIcon
                  title="Report Editor"
                  content="Edit and finalize your inspection report."
                  bullets={[
                    'Draft reports can be edited and saved',
                    'Auto-saves every 30 seconds',
                    'Finalized reports become read-only',
                    'All project data is captured at generation time',
                    'Changes to project after generation don\'t affect report'
                  ]}
                  size="sm"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Status and save info */}
              <div className="text-sm text-gray-500 flex items-center gap-2">
                {isReadOnly ? (
                  <>
                    <span className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                      Finalized on {new Date(report.finalized_at).toLocaleDateString()}
                    </span>
                    <HelpIcon
                      title="Finalized Report"
                      content="This report has been finalized and is read-only."
                      bullets={[
                        'Cannot be edited or modified',
                        'Permanent record of inspection',
                        'Can still be shared and exported',
                        'Create new report for updates'
                      ]}
                      size="sm"
                    />
                  </>
                ) : (
                  <>
                    <span>
                      {saving ? 'Saving...' : (
                        lastSaved ? `Last saved ${lastSaved.toLocaleTimeString()}` : 
                        unsavedChanges ? 'Unsaved changes' : 'All changes saved'
                      )}
                    </span>
                    <HelpIcon
                      title="Auto-Save"
                      content="Reports are automatically saved while you work."
                      bullets={[
                        'Auto-saves every 30 seconds',
                        'Manual save available anytime',
                        'Browser warns before closing with unsaved changes',
                        'Draft reports can be edited multiple times'
                      ]}
                      size="sm"
                    />
                  </>
                )}
              </div>
              
              {/* Actions */}
              {!isReadOnly && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={!unsavedChanges || saving}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleFinalize}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Finalize Report
                    </button>
                    <HelpIcon
                      title="Finalize Report"
                      content="Lock the report to prevent further changes."
                      bullets={[
                        'Makes report permanently read-only',
                        'Required before sharing externally',
                        'Cannot be undone - create new report for updates',
                        'Ensures report integrity for compliance',
                        'Saves will happen automatically before finalizing'
                      ]}
                      size="sm"
                      className="text-green-600"
                    />
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <Link
                  href={`/projects/${projectId}/reports/${reportId}/share`}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Link>
                <HelpIcon
                  title="Share Report"
                  content="Generate shareable links for external viewers."
                  bullets={[
                    'Create public or password-protected links',
                    'Links work without login',
                    'Set expiration dates for security',
                    'Track who has accessed the report',
                    'Revoke access anytime'
                  ]}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/projects/${projectId}/reports/${reportId}/preview`}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Link>
                <HelpIcon
                  title="Preview Report"
                  content="See how the report will appear to viewers."
                  bullets={[
                    'Shows final formatted report',
                    'Check layout and formatting',
                    'Verify all content is included',
                    'Export as PDF from preview',
                    'Same view as shared links'
                  ]}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className={`
                    mr-2 h-5 w-5
                    ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                  `} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <HelpIcon
                      title={tab.help.title}
                      content={tab.help.content}
                      bullets={tab.help.bullets}
                      size="sm"
                      className="ml-2"
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Report Info Bar */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <FileText className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-blue-900">Report Information</h3>
                <HelpIcon
                  title="Report Snapshot"
                  content="This report contains a complete snapshot of project data at generation time."
                  bullets={[
                    'All observations and sections are included',
                    'Data is frozen at report generation',
                    'Future project changes won\'t affect this report',
                    'Ensures consistency for compliance records'
                  ]}
                  size="sm"
                />
              </div>
              <div className="mt-1 text-sm text-blue-700 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium">Project:</span> {report.project_snapshot?.name}
                </div>
                <div>
                  <span className="font-medium">Created:</span> {new Date(report.created_at).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Created by:</span> {report.created_by_profile?.full_name || 'Unknown'}
                </div>
                <div>
                  <span className="font-medium">Total Observations:</span> {report.stats?.total_observations || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Panels */}
        <div className="bg-white shadow rounded-lg">
          {activeTab === 'summary' && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-medium text-gray-900">Executive Summary</h2>
                <HelpIcon
                  title="Writing an Executive Summary"
                  content="Tips for an effective executive summary."
                  bullets={[
                    'Start with overall condition assessment',
                    'Highlight 3-5 most critical findings',
                    'Use non-technical language',
                    'Include total counts (sections, observations)',
                    'End with next steps or urgency statement',
                    'If you see 0.0m in the Total Length you did not add a Finish code',
                    'Keep to 2-3 paragraphs maximum'
                  ]}
                  modal={true}
                />
              </div>
              <ExecutiveSummaryTab
                report={report}
                updateReport={updateReportData}
                isReadOnly={isReadOnly}
              />
            </div>
          )}
          
          {activeTab === 'findings' && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-medium text-gray-900">Findings Review</h2>
                <HelpIcon
                  title="Reviewing Findings"
                  content="Verify all observations are accurate and complete."
                  bullets={[
                    'Check all critical observations are included',
                    'Verify images are clear and relevant',
                    'Review severity classifications',
                    'Note any patterns or recurring issues',
                    'Observations cannot be edited in report'
                  ]}
                />
              </div>
              <FindingsTab
                report={report}
                isReadOnly={isReadOnly}
              />
            </div>
          )}
          
          {activeTab === 'maps' && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-medium text-gray-900">Maps & Drawings</h2>
                <HelpIcon
                  title="Adding Maps"
                  content="Include visual infrastructure documentation."
                  bullets={[
                    'Capture current map state with button',
                    'Maps show nodes, pipes, and observations',
                    'Include multiple views if needed',
                    'Maps help visualize problem areas',
                    'Becomes static image in final report'
                  ]}
                />
              </div>
              <MapSnapshotsTab
                report={report}
                updateReport={updateReportData}
                isReadOnly={isReadOnly}
                projectId={projectId}
              />
            </div>
          )}
          
          {activeTab === 'recommendations' && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-medium text-gray-900">Recommendations</h2>
                <HelpIcon
                  title="Making Recommendations"
                  content="Provide clear, actionable next steps."
                  bullets={[
                    'Prioritize by urgency: Immediate / Short-term / Long-term',
                    'Be specific about locations and issues',
                    'Include repair methods if known',
                    'Estimate costs when possible',
                    'Reference observation numbers',
                    'Consider safety and compliance requirements'
                  ]}
                  modal={true}
                />
              </div>
              <RecommendationsTab
                report={report}
                onUpdate={() => setUnsavedChanges(true)}
                isReadOnly={isReadOnly}
              />
            </div>
          )}
          
          {activeTab === 'settings' && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-medium text-gray-900">Report Settings</h2>
                <HelpIcon
                  title="Report Configuration"
                  content="Customize report appearance and metadata."
                  bullets={[
                    'Update title for different audiences',
                    'Select appropriate branding profile',
                    'Include/exclude optional sections',
                    'Set weather conditions for context',
                    'Changes apply to preview and export'
                  ]}
                />
              </div>
              <SettingsTab
                report={report}
                updateReport={updateReportData}
                isReadOnly={isReadOnly}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}