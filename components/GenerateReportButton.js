// components/GenerateReportButton.js
// Simple button component to initiate report generation

import { useState } from 'react'
import { FileText, Loader } from 'lucide-react'
import { createReport } from '../lib/reports'

export default function GenerateReportButton({ projectId, projectName }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [generatedReport, setGeneratedReport] = useState(null)
  const [error, setError] = useState(null)

  const handleGenerateReport = async () => {
    setIsGenerating(true)
    setError(null)
    
    try {
      // Create the report with snapshot
      const report = await createReport(projectId, {
        title: `Inspection Report - ${projectName}`,
        template: 'standard'
      })
      
      setGeneratedReport(report)
      setShowModal(true)
    } catch (error) {
      console.error('Failed to generate report:', error)
      setError(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleViewReport = () => {
    // Navigate to report builder/viewer
    window.location.href = `/projects/${projectId}/reports/${generatedReport.id}`
  }

  const handleClose = () => {
    setShowModal(false)
    setGeneratedReport(null)
  }

  return (
    <>
      {/* Generate Report Button */}
      <button
        onClick={handleGenerateReport}
        disabled={isGenerating}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <Loader className="h-4 w-4 mr-2 animate-spin" />
            Generating Report...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600">
          Error: {error}
        </div>
      )}

      {/* Success Modal */}
      {showModal && generatedReport && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Report Generated Successfully
                </h3>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-800">
                        Report <strong>{generatedReport.report_number}</strong> has been created with a complete snapshot of your project data.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Report Details</h4>
                  <dl className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Report Number:</dt>
                      <dd className="font-medium">{generatedReport.report_number}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Status:</dt>
                      <dd className="font-medium capitalize">{generatedReport.status}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Created:</dt>
                      <dd className="font-medium">
                        {new Date(generatedReport.created_at).toLocaleDateString()}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Next Steps</h4>
                  <p className="text-sm text-blue-700 mb-3">
                    Your report is ready for editing. You can now:
                  </p>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                    <li>Add an executive summary</li>
                    <li>Create recommendations</li>
                    <li>Apply your company branding</li>
                    <li>Generate share links for clients</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleViewReport}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Edit Report
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}