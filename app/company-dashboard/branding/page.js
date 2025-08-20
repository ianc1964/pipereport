'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import ProtectedRoute from '@/components/ProtectedRoute'
import { 
  ChevronLeft, 
  Palette, 
  Plus, 
  Edit2, 
  Trash2, 
  Check,
  X,
  Save,
  Loader2,
  Star,
  StarOff,
  Upload,
  Building,
  Mail,
  Phone
} from 'lucide-react'
import {
  getBrandingProfiles,
  createBrandingProfile,
  updateBrandingProfile,
  deleteBrandingProfile
} from '@/lib/reports'
import { supabase } from '@/lib/supabase'

export default function BrandingProfilesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  
  // Data states
  const [brandingProfiles, setBrandingProfiles] = useState([])
  
  // Edit states
  const [editingProfile, setEditingProfile] = useState(null)
  const [newProfile, setNewProfile] = useState(null)
  
  // Default profile template
  const defaultProfile = {
    name: '',
    company_name_override: '',
    logo_url: '',
    contact_email: '',
    contact_number: '',
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    accent_color: '#f59e0b',
    heading_font: 'Inter',
    body_font: 'Inter',
    custom_disclaimer: '',
    is_default: false
  }

  useEffect(() => {
    if (!authLoading && user) {
      loadProfiles()
    }
  }, [authLoading, user])

  const loadProfiles = async () => {
    try {
      setLoading(true)
      const profiles = await getBrandingProfiles()
      setBrandingProfiles(profiles || [])
    } catch (error) {
      console.error('Error loading branding profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadLogo = async (file, profileToUpdate, isNew = false) => {
    try {
      setUploadingLogo(true)
      
      // Validate file
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file')
        return null
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Image must be less than 5MB')
        return null
      }
      
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/branding-logos/${Date.now()}.${fileExt}`
      
      const { error: uploadError, data } = await supabase.storage
        .from('images')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName)
      
      // Return the new logo URL instead of updating state directly
      return publicUrl
      
    } catch (error) {
      console.error('Error uploading logo:', error)
      alert('Failed to upload logo: ' + error.message)
      return null
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSaveProfile = async (profile) => {
    try {
      setSaving(true)
      
      // Clean up the profile data to only include valid columns
      const profileData = {
        name: profile.name,
        company_name_override: profile.company_name_override,
        logo_url: profile.logo_url,
        contact_email: profile.contact_email,
        contact_number: profile.contact_number,
        primary_color: profile.primary_color,
        secondary_color: profile.secondary_color,
        accent_color: profile.accent_color,
        heading_font: profile.heading_font,
        body_font: profile.body_font,
        custom_disclaimer: profile.custom_disclaimer,
        is_default: profile.is_default || false
      }
      
      if (profile.id) {
        // Update existing
        await updateBrandingProfile(profile.id, profileData)
      } else {
        // Create new
        await createBrandingProfile(profileData)
      }
      
      setEditingProfile(null)
      setNewProfile(null)
      await loadProfiles()
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProfile = async (id) => {
    if (!confirm('Are you sure you want to delete this branding profile?')) return
    
    try {
      await deleteBrandingProfile(id)
      await loadProfiles()
    } catch (error) {
      console.error('Error deleting profile:', error)
      alert('Failed to delete profile: ' + error.message)
    }
  }

  const handleSetDefault = async (profile) => {
    try {
      setSaving(true)
      await updateBrandingProfile(profile.id, { ...profile, is_default: true })
      await loadProfiles()
    } catch (error) {
      console.error('Error setting default:', error)
      alert('Failed to set default: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const ProfileRow = ({ profile, isEditing, onChange, onSave, onCancel, isNew = false }) => {
    // Local state for editing - this prevents re-renders on every keystroke
    const [localProfile, setLocalProfile] = useState(profile)
    
    // Update local state when profile prop changes
    useEffect(() => {
      setLocalProfile(profile)
    }, [profile])
    
    const handleSave = () => {
      onSave(localProfile)
    }
    
    if (isEditing) {
      return (
        <div className="bg-blue-50 p-6 rounded-lg mb-4 border border-blue-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={localProfile.name}
                  onChange={(e) => setLocalProfile({ ...localProfile, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Standard Report"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={localProfile.company_name_override || ''}
                  onChange={(e) => setLocalProfile({ ...localProfile, company_name_override: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., ABC Engineering Ltd"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={localProfile.contact_email || ''}
                    onChange={(e) => setLocalProfile({ ...localProfile, contact_email: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., info@company.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={localProfile.contact_number || ''}
                    onChange={(e) => setLocalProfile({ ...localProfile, contact_number: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., +44 1234 567890"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo
                </label>
                <div className="flex items-center space-x-3">
                  {localProfile.logo_url && (
                    <img 
                      src={localProfile.logo_url} 
                      alt="Logo" 
                      className="h-12 object-contain"
                    />
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0]
                        if (file) {
                          const logoUrl = await handleUploadLogo(file, localProfile, isNew)
                          if (logoUrl) {
                            setLocalProfile({ ...localProfile, logo_url: logoUrl })
                          }
                        }
                      }}
                      className="sr-only"
                      disabled={uploadingLogo}
                    />
                    <div className="flex items-center px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      <span className="text-sm">Upload Logo</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            {/* Colors & Options */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Primary Color
                  </label>
                  <input
                    type="color"
                    value={localProfile.primary_color}
                    onChange={(e) => setLocalProfile({ ...localProfile, primary_color: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secondary Color
                  </label>
                  <input
                    type="color"
                    value={localProfile.secondary_color}
                    onChange={(e) => setLocalProfile({ ...localProfile, secondary_color: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Accent Color
                  </label>
                  <input
                    type="color"
                    value={localProfile.accent_color}
                    onChange={(e) => setLocalProfile({ ...localProfile, accent_color: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Heading Font
                  </label>
                  <select
                    value={localProfile.heading_font}
                    onChange={(e) => setLocalProfile({ ...localProfile, heading_font: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Montserrat">Montserrat</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Body Font
                  </label>
                  <select
                    value={localProfile.body_font}
                    onChange={(e) => setLocalProfile({ ...localProfile, body_font: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Open Sans">Open Sans</option>
                    <option value="Lato">Lato</option>
                    <option value="Source Sans Pro">Source Sans Pro</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Display Options</p>
                  <p className="text-xs text-gray-500">
                    Additional display settings can be configured when generating reports.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Custom Disclaimer */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custom Disclaimer (Optional)
            </label>
            <textarea
              value={localProfile.custom_disclaimer || ''}
              onChange={(e) => setLocalProfile({ ...localProfile, custom_disclaimer: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Add any custom legal text or disclaimers..."
            />
          </div>
          
          {/* Actions */}
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !localProfile.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Profile
                </>
              )}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-white p-6 rounded-lg mb-4 border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            {profile.logo_url && (
              <img 
                src={profile.logo_url} 
                alt="Logo" 
                className="h-16 w-16 object-contain"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  {profile.name}
                </h3>
                {profile.is_default && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Star className="w-3 h-3 mr-1" />
                    Default
                  </span>
                )}
              </div>
              
              {profile.company_name_override && (
                <p className="text-sm text-gray-600 mt-1">{profile.company_name_override}</p>
              )}
              
              <div className="mt-2 space-y-1">
                {profile.contact_email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    {profile.contact_email}
                  </div>
                )}
                {profile.contact_number && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2 text-gray-400" />
                    {profile.contact_number}
                  </div>
                )}
              </div>
              
              <div className="mt-3 flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-gray-500">Colors:</span>
                  <div 
                    className="w-5 h-5 rounded border border-gray-300"
                    style={{ backgroundColor: profile.primary_color }}
                    title="Primary"
                  />
                  <div 
                    className="w-5 h-5 rounded border border-gray-300"
                    style={{ backgroundColor: profile.secondary_color }}
                    title="Secondary"
                  />
                  <div 
                    className="w-5 h-5 rounded border border-gray-300"
                    style={{ backgroundColor: profile.accent_color }}
                    title="Accent"
                  />
                </div>
                
                <div className="text-xs text-gray-500">
                  Fonts: {profile.heading_font} / {profile.body_font}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            {!profile.is_default && (
              <button
                onClick={() => handleSetDefault(profile)}
                className="p-2 text-gray-400 hover:text-yellow-600"
                title="Set as default"
              >
                <StarOff className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setEditingProfile(profile)}
              className="p-2 text-blue-600 hover:text-blue-900"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDeleteProfile(profile.id)}
              className="p-2 text-red-600 hover:text-red-900"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'company_admin']}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/company-dashboard"
                className="text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <Palette className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Report Branding Profiles
                </h1>
                <p className="text-sm text-gray-600">
                  Create and manage branding profiles for your reports
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Add New Profile Button */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Your Branding Profiles</h2>
              <p className="text-sm text-gray-600 mt-1">
                Set one profile as default to automatically apply it to new reports
              </p>
            </div>
            <button
              onClick={() => setNewProfile({ ...defaultProfile })}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Create Profile</span>
            </button>
          </div>

          {/* Profile List */}
          {newProfile && (
            <ProfileRow
              profile={newProfile}
              isEditing={true}
              onChange={setNewProfile}
              onSave={handleSaveProfile}
              onCancel={() => setNewProfile(null)}
              isNew={true}
            />
          )}
          
          {brandingProfiles.map((profile) => (
            <ProfileRow
              key={profile.id}
              profile={profile}
              isEditing={editingProfile?.id === profile.id}
              onChange={setEditingProfile}
              onSave={handleSaveProfile}
              onCancel={() => setEditingProfile(null)}
              isNew={false}
            />
          ))}
          
          {brandingProfiles.length === 0 && !newProfile && (
            <div className="bg-white rounded-lg p-12 text-center">
              <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No branding profiles yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first branding profile to add your company logo and colors to reports.
              </p>
              <button
                onClick={() => setNewProfile({ ...defaultProfile })}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}