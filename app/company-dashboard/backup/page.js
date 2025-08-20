'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { ChevronLeft, Download, Archive, Calendar, FileJson, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { generateBackupAction } from '@/lib/actions/generate-backup'

export default function CompanyBackupPage() {
  const router = useRouter()
  const { user, company, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [projects, setProjects] = useState([])
  const [selectedProjects, setSelectedProjects] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [backupStats, setBackupStats] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Load projects and calculate stats
  useEffect(() => {
    if (!authLoading && company?.id) {
      loadProjectsAndStats()
    }
  }, [authLoading, company])

  const loadProjectsAndStats = async () => {
    try {
      setLoading(true)
      setError(null)

      // First, get all projects for the company (simplified query)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (projectsError) {
        console.error('Projects error:', projectsError)
        throw projectsError
      }

      // Then get sections and observations count for stats
      let totalSections = 0
      let totalObservations = 0
      
      if (projectsData && projectsData.length > 0) {
        // Get sections for all projects
        const projectIds = projectsData.map(p => p.id)
        const { data: sectionsData, error: sectionsError } = await supabase
          .from('sections')
          .select('id, project_id')
          .in('project_id', projectIds)

        if (sectionsError) {
          console.error('Sections error:', sectionsError)
        } else {
          totalSections = sectionsData?.length || 0
          
          // Get observations count if we have sections
          if (sectionsData && sectionsData.length > 0) {
            const sectionIds = sectionsData.map(s => s.id)
            const { count, error: obsError } = await supabase
              .from('observations')
              .select('*', { count: 'exact', head: true })
              .in('section_id', sectionIds)
              
            if (!obsError) {
              totalObservations = count || 0
            }
          }
        }
        
        // Add section count to each project
        for (const project of projectsData) {
          const projectSections = sectionsData?.filter(s => s.project_id === project.id) || []
          project.sectionsCount = projectSections.length
        }
      }

      setProjects(projectsData || [])
      setBackupStats({
        totalProjects: projectsData?.length || 0,
        totalSections,
        totalObservations,
        lastBackup: null
      })

    } catch (error) {
      console.error('Error loading projects:', error)
      setError('Failed to load projects. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedProjects([])
    } else {
      setSelectedProjects(projects.map(p => p.id))
    }
    setSelectAll(!selectAll)
  }

  const handleProjectToggle = (projectId) => {
    setSelectedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId)
      } else {
        return [...prev, projectId]
      }
    })
  }

  const generateBackup = async () => {
    if (selectedProjects.length === 0) {
      setError('Please select at least one project to backup')
      return
    }

    if (!company?.id || !user?.id) {
      setError('Authentication error. Please refresh the page and try again.')
      return
    }

    try {
      setGenerating(true)
      setError(null)
      setSuccess(null)

      // Call server action to generate backup - pass user and company info
      const result = await generateBackupAction({
        selectedProjectIds: selectedProjects,
        userId: user.id,
        companyId: company.id,
        companyName: company.name
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate backup')
      }

      // Create and download the file
      const blob = new Blob(
        [atob(result.content)], 
        { type: 'application/json' }
      )
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setSuccess(`Backup generated successfully! Downloaded ${result.stats.total_projects} projects with ${result.stats.total_observations} observations.`)
      
      // Clear selection after successful backup
      setSelectedProjects([])
      setSelectAll(false)

    } catch (error) {
      console.error('Error generating backup:', error)
      setError(error.message || 'Failed to generate backup. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (authLoading || loading) {
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
                <Archive className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Data Backup
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Download backup of your projects and inspection data
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {backupStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Projects</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {backupStats.totalProjects}
                  </p>
                </div>
                <FileJson className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Sections</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {backupStats.totalSections}
                  </p>
                </div>
                <FileJson className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Observations</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {backupStats.totalObservations}
                  </p>
                </div>
                <FileJson className="w-8 h-8 text-gray-400" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Selected for Backup</p>
                  <p className="text-2xl font-semibold text-blue-600">
                    {selectedProjects.length}
                  </p>
                </div>
                <Download className="w-8 h-8 text-gray-400" />
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" />
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Backup Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Backup Options
          </h2>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Backups include all project data, sections, observations, 
                and map configurations. Video and image files are not included to keep the backup 
                size manageable. File references are preserved so you know which media files belong 
                to each observation.
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Select projects to backup</p>
                <p className="text-sm text-gray-500">Choose specific projects or select all</p>
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Select All</span>
              </label>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Projects
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {projects.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No projects found</p>
              </div>
            ) : (
              projects.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center px-6 py-4 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(project.id)}
                    onChange={() => handleProjectToggle(project.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-4 flex-1">
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                      <span>{project.sectionsCount || 0} sections</span>
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
                </label>
              ))
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={generateBackup}
            disabled={generating || selectedProjects.length === 0}
            className="flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader className="w-5 h-5 mr-2 animate-spin" />
                Generating Backup...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Generate Backup
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}