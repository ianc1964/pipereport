// app/projects/[id]/reports/page.js
// Lists all reports for a project

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, 
  Plus, 
  Calendar, 
  User, 
  CheckCircle, 
  Clock,
  Eye,
  Download,
  Trash2,
  Share2,
  ChevronLeft
} from 'lucide-react'
import { getProjectReports, deleteReport, finalizeReport } from '../../../../lib/reports'
import { supabase } from '../../../../lib/supabase'

export default function ProjectReportsPage() {
  const params = useParams()
  const projectId = params.id
  
  const [reports, setReports] = useState([])
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [finalizingId, setFinalizingId] = useState(null)

  useEffect(() => {
    loadProjectAndReports()
  }, [projectId])

  const loadProjectAndReports = async () => {
    try {
      setLoading(true)
      
      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      
      if (projectError) throw projectError
      setProject(projectData)
      
      // Load reports
      const reportsData = await getProjectReports(projectId)
      setReports(reportsData)
    } catch (err) {
      console.error('Error loading data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this draft report?')) {
      return
    }
    
    try {
      setDeletingId(reportId)
      await deleteReport(reportId)
      await loadProjectAndReports() // Reload list
    } catch (err) {
      console.error('Error deleting report:', err)
      alert('Failed to delete report: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleFinalize = async (reportId) => {
    if (!window.confirm('Are you sure you want to finalize this report? Once finalized, it cannot be edited.')) {
      return
    }
    
    try {
      setFinalizingId(reportId)
      await finalizeReport(reportId)
      await loadProjectAndReports() // Reload list
    } catch (err) {
      console.error('Error finalizing report:', err)
      alert('Failed to finalize report: ' + err.message)
    } finally {
      setFinalizingId(null)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      draft: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          Draft
        </span>
      ),
      final: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Final
        </span>
      ),
      superseded: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Superseded
        </span>
      )
    }
    return badges[status] || null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
          <Link href={`/projects/${projectId}`} className="mt-4 text-blue-600 hover:underline">
            Back to Project
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href={`/projects/${projectId}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Project
        </Link>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="mt-2 text-gray-600">
              {project?.name} - Inspection Reports
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/reports/new`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Report
          </Link>
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No reports yet</h3>
          <p className="text-gray-500 mb-6">
            Generate your first report to share inspection findings with clients.
          </p>
          <Link
            href={`/projects/${projectId}/reports/new`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate First Report
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {reports.map((report) => (
              <li key={report.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <FileText className="h-10 w-10 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-gray-900">
                            {report.report_number}
                          </h3>
                          <span className="ml-3">
                            {getStatusBadge(report.status)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(report.created_at).toLocaleDateString()}
                          <span className="mx-2">•</span>
                          <User className="h-4 w-4 mr-1" />
                          {report.created_by_profile?.full_name || 'Unknown'}
                          {report.stats && (
                            <>
                              <span className="mx-2">•</span>
                              <span>{report.stats.total_observations} observations</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {report.status === 'draft' ? (
                        <>
                          <Link
                            href={`/projects/${projectId}/reports/${report.id}`}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleFinalize(report.id)}
                            disabled={finalizingId === report.id}
                            className="inline-flex items-center px-3 py-1 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 disabled:opacity-50"
                          >
                            {finalizingId === report.id ? 'Finalizing...' : 'Finalize'}
                          </button>
                          <button
                            onClick={() => handleDelete(report.id)}
                            disabled={deletingId === report.id}
                            className="inline-flex items-center px-3 py-1 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={`/projects/${projectId}/reports/${report.id}/view`}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                          <Link
                            href={`/projects/${projectId}/reports/${report.id}/share`}
                            className="inline-flex items-center px-3 py-1 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
                          >
                            <Share2 className="h-4 w-4 mr-1" />
                            Share
                          </Link>
                          <button
                            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}