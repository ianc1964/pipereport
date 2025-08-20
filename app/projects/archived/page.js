'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Archive, RotateCcw, ChevronLeft, Calendar, MapPin, User, Video, FileText, Eye, Search, AlertTriangle } from 'lucide-react'
import { getArchivedProjects, restoreProject } from '@/lib/actions/project-archive'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function ArchivedProjectsPage() {
  return (
    <ProtectedRoute>
      <ArchivedProjectsContent />
    </ProtectedRoute>
  )
}

function ArchivedProjectsContent() {
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState([])
  const [filteredProjects, setFilteredProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoringProject, setRestoringProject] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) {
      loadArchivedProjects()
    }
  }, [authLoading, user])

  useEffect(() => {
    // Filter projects based on search
    if (searchTerm) {
      const filtered = projects.filter(project => 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.archive_reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.site_town_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredProjects(filtered)
    } else {
      setFilteredProjects(projects)
    }
  }, [projects, searchTerm])

  const loadArchivedProjects = async () => {
    if (!user || !user.id) {
      console.error('No user found')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const result = await getArchivedProjects(user.id)  // Pass user.id here
      
      if (result.success) {
        setProjects(result.data)
        setFilteredProjects(result.data)
      } else {
        console.error('Error loading archived projects:', result.error)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreProject = async (projectId, projectName) => {
    if (!user || !user.id) {
      alert('You must be logged in to restore projects')
      return
    }

    if (!confirm(`Are you sure you want to restore "${projectName}"? It will be moved back to your active projects.`)) {
      return
    }

    setRestoringProject(projectId)
    
    try {
      const result = await restoreProject(projectId, user.id, 'in_progress')  // Pass user.id here
      
      if (result.success) {
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== projectId))
        
        // Show success message (you might want to use a toast library here)
        alert(`Project "${projectName}" has been restored successfully!`)
      } else {
        alert(`Failed to restore project: ${result.error}`)
      }
    } catch (error) {
      console.error('Restore error:', error)
      alert('Failed to restore project. Please try again.')
    } finally {
      setRestoringProject(null)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getProjectStats = (project) => {
    const sectionCount = project.sections?.length || 0
    const videoCount = project.sections?.filter(s => s.video_url)?.length || 0
    const observationCount = project.sections?.reduce((acc, s) => acc + (s.observations?.length || 0), 0) || 0
    return { sectionCount, videoCount, observationCount }
  }

  const getReasonLabel = (reason) => {
    const reasonMap = {
      'completed': 'Project Completed',
      'cancelled': 'Project Cancelled',
      'on_hold': 'On Hold',
      'delivered': 'Delivered to Client',
      'other': 'Other'
    }
    return reasonMap[reason] || reason || 'No reason provided'
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-500">Loading archived projects...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Active Projects
        </Link>
        
        <div className="flex items-center mb-2">
          <Archive className="w-8 h-8 text-gray-700 mr-3" />
          <h1 className="text-3xl font-bold text-gray-900">Archived Projects</h1>
        </div>
        
        <p className="text-gray-600">
          View and restore your archived projects ({filteredProjects.length} of {projects.length} shown)
        </p>
      </div>

      {/* Info Banner */}
      {projects.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">About Archived Projects</p>
              <p className="mt-1">
                Archived projects are hidden from your main project list but all data is preserved. 
                You can restore any project at any time to continue working on it.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {projects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search archived projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const stats = getProjectStats(project)
            
            return (
              <div key={project.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {/* Project Header */}
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {project.name}
                  </h3>
                  <div className="mt-2 text-sm text-gray-600">
                    Archived: {formatDate(project.archived_at)}
                  </div>
                </div>

                {/* Archive Reason */}
                <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Reason: </span>
                    <span className="text-gray-600">{getReasonLabel(project.archive_reason)}</span>
                  </div>
                </div>

                {/* Project Info */}
                <div className="p-4">
                  {/* Location and Client */}
                  <div className="space-y-2 mb-4">
                    {project.site_town_city && (
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-3 h-3 mr-2 text-gray-400" />
                        <span className="truncate">{project.site_town_city}</span>
                      </div>
                    )}
                    {project.client_name && (
                      <div className="flex items-center text-sm text-gray-600">
                        <User className="w-3 h-3 mr-2 text-gray-400" />
                        <span className="truncate">{project.client_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-lg font-semibold text-gray-900">{stats.sectionCount}</div>
                      <div className="text-xs text-gray-500">Sections</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-lg font-semibold text-gray-900">{stats.videoCount}</div>
                      <div className="text-xs text-gray-500">Videos</div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-lg font-semibold text-gray-900">{stats.observationCount}</div>
                      <div className="text-xs text-gray-500">Observations</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestoreProject(project.id, project.name)}
                      disabled={restoringProject === project.id}
                      className="flex-1 bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      {restoringProject === project.id ? 'Restoring...' : 'Restore'}
                    </button>
                    <Link 
                      href={`/projects/${project.id}`}
                      className="flex-1 bg-gray-600 text-white text-center py-2 px-3 rounded text-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors flex items-center justify-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <Archive className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No archived projects match your search' : 'No archived projects'}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {searchTerm 
              ? 'Try adjusting your search terms to find projects.'
              : 'When you archive completed or inactive projects, they will appear here.'}
          </p>
          {searchTerm ? (
            <button
              onClick={() => setSearchTerm('')}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Clear Search
            </button>
          ) : (
            <Link 
              href="/"
              className="inline-flex items-center bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Active Projects
            </Link>
          )}
        </div>
      )}
    </div>
  )
}