'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { ChevronLeft, Upload, Archive, Calendar, AlertCircle, CheckCircle, Loader, FileJson, RefreshCw, Info } from 'lucide-react'
import { restoreProjectsAction } from '@/lib/actions/restore-projects'

export default function CompanyRestorePage() {
  const { user, company, loading: authLoading } = useAuth()
  const [selectedFile, setSelectedFile] = useState(null)
  const [backupData, setBackupData] = useState(null)
  const [selectedProjects, setSelectedProjects] = useState([])
  const [conflictResolution, setConflictResolution] = useState({}) // projectId -> 'skip' | 'replace' | 'rename'
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [existingProjects, setExistingProjects] = useState([])

  const handleFileSelect = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setError(null)
    setParseError(null)
    setSuccess(null)
    setSelectedFile(file)

    // Read and parse the file
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate backup structure
      if (!data.backup_version || !data.projects || !Array.isArray(data.projects)) {
        throw new Error('Invalid backup file format')
      }

      // Check backup version compatibility
      if (data.backup_version !== '1.0') {
        throw new Error(`Unsupported backup version: ${data.backup_version}`)
      }

      setBackupData(data)
      
      // Auto-select all projects initially
      setSelectedProjects(data.projects.map((_, index) => index))

      // Check for existing projects with same names
      await checkExistingProjects(data.projects)

    } catch (err) {
      console.error('Parse error:', err)
      setParseError(err.message || 'Failed to parse backup file')
      setBackupData(null)
      setSelectedProjects([])
    }
  }

  const checkExistingProjects = async (backupProjects) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      
      // Get current project names
      const { data: currentProjects, error } = await supabase
        .from('projects')
        .select('id, name')
      
      if (error) throw error

      // Find conflicts
      const conflicts = []
      backupProjects.forEach((backupItem, index) => {
        const existing = currentProjects?.find(p => p.name === backupItem.project.name)
        if (existing) {
          conflicts.push({
            backupIndex: index,
            backupProject: backupItem.project,
            existingProject: existing
          })
        }
      })

      setExistingProjects(conflicts)
      
      // Set default conflict resolution to 'rename'
      const defaultResolutions = {}
      conflicts.forEach(conflict => {
        defaultResolutions[conflict.backupIndex] = 'rename'
      })
      setConflictResolution(defaultResolutions)

    } catch (err) {
      console.error('Error checking existing projects:', err)
    }
  }

  const handleProjectToggle = (index) => {
    setSelectedProjects(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index)
      } else {
        return [...prev, index]
      }
    })
  }

  const handleSelectAll = () => {
    if (selectedProjects.length === backupData.projects.length) {
      setSelectedProjects([])
    } else {
      setSelectedProjects(backupData.projects.map((_, index) => index))
    }
  }

  const handleConflictResolution = (projectIndex, resolution) => {
    setConflictResolution(prev => ({
      ...prev,
      [projectIndex]: resolution
    }))
  }

  const getProjectDisplayName = (project, index) => {
    const conflict = existingProjects.find(c => c.backupIndex === index)
    if (conflict && conflictResolution[index] === 'rename') {
      return `${project.name} (Restored)`
    }
    return project.name
  }

  const handleRestore = async () => {
    if (selectedProjects.length === 0) {
      setError('Please select at least one project to restore')
      return
    }

    if (!company?.id || !user?.id) {
      setError('Authentication error. Please refresh the page and try again.')
      return
    }

    try {
      setRestoring(true)
      setError(null)
      setSuccess(null)

      // Prepare selected projects with conflict resolution
      const projectsToRestore = selectedProjects.map(index => {
        const projectData = backupData.projects[index]
        const resolution = conflictResolution[index] || 'rename'
        
        return {
          ...projectData,
          conflictResolution: resolution,
          newName: resolution === 'rename' ? getProjectDisplayName(projectData.project, index) : projectData.project.name
        }
      })

      // Call server action to restore projects
      const result = await restoreProjectsAction({
        userId: user.id,
        companyId: company.id,
        backupData: {
          ...backupData,
          projects: projectsToRestore
        }
      })

      console.log('Restore result:', result)
      
      // Show detailed error information
      if (result.errors && result.errors.length > 0) {
        console.error('Restore errors:', result.errors)
      }

      if (!result.success) {
        // If there are specific project errors, show them
        if (result.errors && result.errors.length > 0) {
          const errorMessage = result.errors.map(e => `${e.project}: ${e.error}`).join('\n')
          throw new Error(errorMessage)
        }
        throw new Error(result.error || 'Failed to restore projects')
      }

      const details = result.message || `Successfully restored ${result.restoredCount} project(s)`
      setSuccess(details)
      
      console.log('Restore completed:', result)
      
      // Clear selection
      setSelectedProjects([])
      setBackupData(null)
      setSelectedFile(null)
      
      // Reset file input
      const fileInput = document.getElementById('backup-file-input')
      if (fileInput) fileInput.value = ''

    } catch (err) {
      console.error('Restore error details:', err)
      console.error('Full error object:', JSON.stringify(err, null, 2))
      setError(err.message || 'Failed to restore projects. Please try again.')
    } finally {
      setRestoring(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">No company found. Please contact support.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link
                  href="/company-dashboard"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Link>
                <RefreshCw className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Restore from Backup
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Upload a backup file and selectively restore projects
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-2">How to restore from backup:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Select your backup JSON file using the upload button below</li>
                <li>Review the projects contained in the backup</li>
                <li>Select which projects you want to restore</li>
                <li>Choose how to handle any naming conflicts</li>
                <li>Click "Restore Selected Projects" to begin the restoration</li>
              </ol>
              <div className="mt-3 p-3 bg-white border border-blue-300 rounded">
                <p className="font-medium text-blue-900 mb-1">What gets restored:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                  <li>All project information and settings</li>
                  <li>All sections with video references and metadata</li>
                  <li>All observations with complete details</li>
                  <li>All map configurations, nodes, lines, and drawings</li>
                  <li>Original file paths and URLs (for reference)</li>
                </ul>
                <p className="mt-2 text-blue-800">
                  <strong>Important:</strong> While all data and file references are preserved, the actual media files 
                  (videos/images) need to be uploaded again to their original locations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {parseError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
            <p className="text-red-800">Invalid backup file: {parseError}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
            <div>
              <p className="text-green-800">{success}</p>
              <Link href="/" className="text-green-700 underline hover:text-green-800 text-sm">
                View all projects →
              </Link>
            </div>
          </div>
        )}

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Select Backup File
          </h2>
          <div className="flex items-center space-x-4">
            <label className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
              <Upload className="w-5 h-5 mr-2" />
              Choose File
              <input
                id="backup-file-input"
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
            {selectedFile && (
              <div className="flex items-center text-sm text-gray-600">
                <FileJson className="w-4 h-4 mr-2" />
                {selectedFile.name}
              </div>
            )}
          </div>
        </div>

        {/* Backup Info */}
        {backupData && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Backup Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="font-medium">{backupData.company.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Backup Date</p>
                  <p className="font-medium">
                    {new Date(backupData.generated_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Total Projects</p>
                  <p className="font-medium">{backupData.metadata.total_projects}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Observations</p>
                  <p className="font-medium">{backupData.metadata.total_observations}</p>
                </div>
              </div>
            </div>

            {/* Project Selection */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Select Projects to Restore
                  </h2>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedProjects.length === backupData.projects.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Select All</span>
                  </label>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {backupData.projects.map((projectItem, index) => {
                  const project = projectItem.project
                  const conflict = existingProjects.find(c => c.backupIndex === index)
                  
                  return (
                    <div key={index} className="p-6">
                      <div className="flex items-start">
                        <input
                          type="checkbox"
                          checked={selectedProjects.includes(index)}
                          onChange={() => handleProjectToggle(index)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {getProjectDisplayName(project, index)}
                              </p>
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                                <span>{projectItem.sections?.length || 0} sections</span>
                                <span>{projectItem.observations?.length || 0} observations</span>
                                <span>{projectItem.nodes?.length || 0} nodes</span>
                                <span>{projectItem.drawings?.length || 0} drawings</span>
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {new Date(project.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              project.status === 'complete' ? 'bg-green-100 text-green-800' :
                              project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {project.status}
                            </div>
                          </div>
                          
                          {/* Conflict Resolution */}
                          {conflict && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-sm font-medium text-yellow-800 mb-2">
                                A project named "{project.name}" already exists
                              </p>
                              <div className="space-y-2">
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name={`conflict-${index}`}
                                    value="rename"
                                    checked={conflictResolution[index] === 'rename'}
                                    onChange={() => handleConflictResolution(index, 'rename')}
                                    className="text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">
                                    Rename to "{project.name} (Restored)"
                                  </span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="radio"
                                    name={`conflict-${index}`}
                                    value="skip"
                                    checked={conflictResolution[index] === 'skip'}
                                    onChange={() => handleConflictResolution(index, 'skip')}
                                    className="text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">
                                    Skip this project
                                  </span>
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Restore Button */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleRestore}
                disabled={restoring || selectedProjects.length === 0}
                className="flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restoring ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Restoring Projects...
                  </>
                ) : (
                  <>
                    <Archive className="w-5 h-5 mr-2" />
                    Restore Selected Projects
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}