// app/projects/[id]/reports/[reportId]/share/page.js
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { 
  getReport, 
  getReportShares, 
  createReportShare, 
  updateReportShare, 
  deleteReportShare 
} from '@/lib/reports'
import { 
  Share2, 
  Copy, 
  Trash2, 
  Plus, 
  ExternalLink,
  Calendar,
  Eye,
  Shield,
  Settings,
  Check,
  X,
  AlertCircle,
  Download,
  Printer,
  Droplets,
  Lock,
  Clock,
  Users
} from 'lucide-react'

export default function ShareManagementPage() {
  const params = useParams()
  const router = useRouter()
  const { id: projectId, reportId } = params

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [report, setReport] = useState(null)
  const [shares, setShares] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [error, setError] = useState(null)

  // Create share form state
  const [newShare, setNewShare] = useState({
    expires_at: '',
    max_views: '',
    allow_download: false,
    allow_print: true,
    watermark_enabled: true,
    watermark_text: 'CONFIDENTIAL',
    password: ''
  })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    loadData()
  }

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load report
      const reportData = await getReport(reportId)
      setReport(reportData)
      
      // Load shares
      const sharesData = await getReportShares(reportId)
      setShares(sharesData)
    } catch (error) {
      console.error('Error loading data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateShare = async (e) => {
    e.preventDefault()
    
    try {
      setCreating(true)
      setError(null)
      
      const shareData = {
        // Clean up empty values
        expires_at: newShare.expires_at || null,
        max_views: newShare.max_views ? parseInt(newShare.max_views) : null,
        allow_download: newShare.allow_download,
        allow_print: newShare.allow_print,
        watermark_enabled: newShare.watermark_enabled,
        watermark_text: newShare.watermark_text || 'CONFIDENTIAL',
        is_active: true
      }
      
      // Add password if provided
      if (newShare.password) {
        // In a real app, you'd hash this server-side
        shareData.password_hash = newShare.password
      }
      
      const share = await createReportShare(reportId, shareData)
      setShares([share, ...shares])
      
      // Reset form
      setShowCreateForm(false)
      setNewShare({
        expires_at: '',
        max_views: '',
        allow_download: false,
        allow_print: true,
        watermark_enabled: true,
        watermark_text: 'CONFIDENTIAL',
        password: ''
      })
    } catch (error) {
      console.error('Error creating share:', error)
      setError('Failed to create share link')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (shareId, currentStatus) => {
    try {
      await updateReportShare(shareId, { is_active: !currentStatus })
      setShares(shares.map(s => 
        s.id === shareId ? { ...s, is_active: !currentStatus } : s
      ))
    } catch (error) {
      console.error('Error updating share:', error)
      setError('Failed to update share status')
    }
  }

  const handleDeleteShare = async (shareId) => {
    if (!confirm('Are you sure you want to delete this share link?')) return
    
    try {
      await deleteReportShare(shareId)
      setShares(shares.filter(s => s.id !== shareId))
    } catch (error) {
      console.error('Error deleting share:', error)
      setError('Failed to delete share link')
    }
  }

  const copyShareLink = (shareToken) => {
    const url = `${window.location.origin}/reports/${shareToken}`
    navigator.clipboard.writeText(url)
    setCopiedId(shareToken)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getShareStatus = (share) => {
    if (!share.is_active) return { label: 'Inactive', color: 'gray' }
    
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return { label: 'Expired', color: 'red' }
    }
    
    if (share.max_views && share.view_count >= share.max_views) {
      return { label: 'View Limit Reached', color: 'orange' }
    }
    
    return { label: 'Active', color: 'green' }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Report not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center text-sm text-gray-600 mb-4">
          <Link href={`/projects/${projectId}`} className="hover:text-gray-900">
            {report.project_snapshot?.name || 'Project'}
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/projects/${projectId}/reports`} className="hover:text-gray-900">
            Reports
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/projects/${projectId}/reports/${reportId}`} className="hover:text-gray-900">
            {report.report_number}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Share</span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Share Report</h1>
            <p className="text-gray-600 mt-1">
              Manage access to report #{report.report_number}
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Share Link
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Create Share Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Share Link</h2>
          
          <form onSubmit={handleCreateShare} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Expiry Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={newShare.expires_at}
                  onChange={(e) => setNewShare({ ...newShare, expires_at: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* View Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Eye className="w-4 h-4 inline mr-1" />
                  View Limit (Optional)
                </label>
                <input
                  type="number"
                  value={newShare.max_views}
                  onChange={(e) => setNewShare({ ...newShare, max_views: e.target.value })}
                  placeholder="Unlimited"
                  min="1"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Lock className="w-4 h-4 inline mr-1" />
                  Password Protection (Optional)
                </label>
                <input
                  type="password"
                  value={newShare.password}
                  onChange={(e) => setNewShare({ ...newShare, password: e.target.value })}
                  placeholder="No password"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Watermark Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Droplets className="w-4 h-4 inline mr-1" />
                  Watermark Text
                </label>
                <input
                  type="text"
                  value={newShare.watermark_text}
                  onChange={(e) => setNewShare({ ...newShare, watermark_text: e.target.value })}
                  placeholder="CONFIDENTIAL"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Shield className="w-4 h-4 inline mr-1" />
                Permissions
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newShare.allow_print}
                    onChange={(e) => setNewShare({ ...newShare, allow_print: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    <Printer className="w-4 h-4 inline mr-1" />
                    Allow printing
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newShare.allow_download}
                    onChange={(e) => setNewShare({ ...newShare, allow_download: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    <Download className="w-4 h-4 inline mr-1" />
                    Allow download (future feature)
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newShare.watermark_enabled}
                    onChange={(e) => setNewShare({ ...newShare, watermark_enabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    <Droplets className="w-4 h-4 inline mr-1" />
                    Enable watermark
                  </span>
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Share Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Existing Shares */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Active Share Links</h2>
          <p className="text-sm text-gray-600 mt-1">
            {shares.length} share {shares.length === 1 ? 'link' : 'links'} created
          </p>
        </div>

        {shares.length === 0 ? (
          <div className="p-12 text-center">
            <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No share links created yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create your first share link
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {shares.map(share => {
              const status = getShareStatus(share)
              const shareUrl = `${window.location.origin}/reports/${share.share_token}`
              
              return (
                <div key={share.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Share URL */}
                      <div className="flex items-center space-x-2 mb-2">
                        <input
                          type="text"
                          value={shareUrl}
                          readOnly
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-md text-sm"
                        />
                        <button
                          onClick={() => copyShareLink(share.share_token)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                        >
                          {copiedId === share.share_token ? (
                            <>
                              <Check className="w-4 h-4 mr-1 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" />
                              Copy
                            </>
                          )}
                        </button>
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>

                      {/* Share Details */}
                      <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600">
                        {/* Status */}
                        <div className="flex items-center">
                          <span className={`
                            inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                            ${status.color === 'green' ? 'bg-green-100 text-green-800' : ''}
                            ${status.color === 'red' ? 'bg-red-100 text-red-800' : ''}
                            ${status.color === 'orange' ? 'bg-orange-100 text-orange-800' : ''}
                            ${status.color === 'gray' ? 'bg-gray-100 text-gray-800' : ''}
                          `}>
                            {status.label}
                          </span>
                        </div>

                        {/* Views */}
                        <div className="flex items-center">
                          <Eye className="w-4 h-4 mr-1" />
                          {share.view_count || 0} views
                          {share.max_views && ` / ${share.max_views} max`}
                        </div>

                        {/* Expiry */}
                        {share.expires_at && (
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            Expires {new Date(share.expires_at).toLocaleDateString()}
                          </div>
                        )}

                        {/* Created */}
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Created {new Date(share.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Permissions */}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {share.allow_print && (
                          <span className="flex items-center text-gray-600">
                            <Printer className="w-4 h-4 mr-1" />
                            Print allowed
                          </span>
                        )}
                        {share.watermark_enabled && (
                          <span className="flex items-center text-gray-600">
                            <Droplets className="w-4 h-4 mr-1" />
                            Watermarked
                          </span>
                        )}
                        {share.password_hash && (
                          <span className="flex items-center text-gray-600">
                            <Lock className="w-4 h-4 mr-1" />
                            Password protected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(share.id, share.is_active)}
                        className={`
                          inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium
                          ${share.is_active 
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }
                        `}
                      >
                        {share.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteShare(share.id)}
                        className="inline-flex items-center p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          <Settings className="w-4 h-4 inline mr-1" />
          Share Link Tips
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Share links provide read-only access to your report</li>
          <li>• Recipients don't need an account to view the report</li>
          <li>• You can set expiry dates and view limits for security</li>
          <li>• Deactivated links can be reactivated at any time</li>
          <li>• View counts help you track report engagement</li>
        </ul>
      </div>
    </div>
  )
}