'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Save,
  X,
  Edit2,
  AlertCircle,
  CheckCircle,
  Upload,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  User,
  FileText,
  FileImage
} from 'lucide-react'

export default function CompanySettingsPage() {
  const router = useRouter()
  const { user, company, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [companyData, setCompanyData] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  // Edit mode states
  const [isEditingBasic, setIsEditingBasic] = useState(false)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [editForm, setEditForm] = useState({})
  
  // File upload states
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingDocument, setUploadingDocument] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [documentFile, setDocumentFile] = useState(null)
  const [documentPreview, setDocumentPreview] = useState(null)

  useEffect(() => {
    if (!authLoading && company?.id) {
      loadCompanyData()
    }
  }, [authLoading, company])

  async function loadCompanyData() {
    try {
      setLoading(true)
      setError(null)
      
      // Load company data
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', company.id)
        .single()
      
      if (companyError) throw companyError
      
      setCompanyData(companyData)
      setEditForm({
        // Basic info
        name: companyData.name || '',
        main_contact_email: companyData.main_contact_email || '',
        logo_url: companyData.logo_url || '',
        document_url: companyData.document_url || '',
        
        // Address
        street_address: companyData.street_address || '',
        town_city: companyData.town_city || '',
        region_county: companyData.region_county || '',
        postal_code: companyData.postal_code || '',
        
        // Contact
        contact_name: companyData.contact_name || '',
        contact_phone: companyData.contact_phone || '',
        contact_email: companyData.contact_email || ''
      })
      
    } catch (err) {
      console.error('Error loading company data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveSection(section) {
    try {
      setSaving(true)
      setError(null)
      
      // Prepare update data based on section
      let updateData = { updated_at: new Date().toISOString() }
      
      if (section === 'basic') {
        updateData.name = editForm.name
        updateData.main_contact_email = editForm.main_contact_email
        
        // Upload logo if changed
        if (logoFile) {
          const logoUrl = await uploadFile(logoFile, 'logo')
          if (logoUrl) {
            updateData.logo_url = logoUrl
            editForm.logo_url = logoUrl
          }
        }
        
        // Upload document if changed
        if (documentFile) {
          const docUrl = await uploadFile(documentFile, 'document')
          if (docUrl) {
            updateData.document_url = docUrl
            editForm.document_url = docUrl
          }
        }
      } else if (section === 'address') {
        updateData.street_address = editForm.street_address
        updateData.town_city = editForm.town_city
        updateData.region_county = editForm.region_county
        updateData.postal_code = editForm.postal_code
      } else if (section === 'contact') {
        updateData.contact_name = editForm.contact_name
        updateData.contact_phone = editForm.contact_phone
        updateData.contact_email = editForm.contact_email
      }
      
      // Update company
      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', company.id)
      
      if (error) throw error
      
      // Update local state
      setCompanyData({ ...companyData, ...updateData })
      
      // Close edit mode
      if (section === 'basic') setIsEditingBasic(false)
      else if (section === 'address') setIsEditingAddress(false)
      else if (section === 'contact') setIsEditingContact(false)
      
      // Clear file states
      setLogoFile(null)
      setLogoPreview(null)
      setDocumentFile(null)
      setDocumentPreview(null)
      
      setSuccess('Company settings updated successfully')
      setTimeout(() => setSuccess(null), 3000)
      
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadFile(file, type) {
    if (!file) return null
    
    try {
      const setUploading = type === 'logo' ? setUploadingLogo : setUploadingDocument
      setUploading(true)
      
      // Delete old file if exists
      const oldUrl = type === 'logo' ? companyData.logo_url : companyData.document_url
      if (oldUrl) {
        const urlParts = oldUrl.split('/storage/v1/object/public/images/')
        if (urlParts.length > 1) {
          const oldPath = urlParts[1]
          await supabase.storage.from('images').remove([oldPath])
        }
      }
      
      // Upload new file
      const fileExt = file.name.split('.').pop()
      const fileName = `${company.id}_${type}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/company-${type}s/${fileName}`
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file)
      
      if (uploadError) throw uploadError
      
      // Get public URL
      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)
      
      return data.publicUrl
      
    } catch (err) {
      console.error(`Error uploading ${type}:`, err)
      setError(`Failed to upload ${type}: ${err.message}`)
      return null
    } finally {
      const setUploading = type === 'logo' ? setUploadingLogo : setUploadingDocument
      setUploading(false)
    }
  }

  function handleFileSelect(e, type) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.startsWith('image/') && type === 'logo') {
      setError('Please select an image file for logo')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be less than 5MB')
      return
    }
    
    if (type === 'logo') {
      setLogoFile(file)
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => setLogoPreview(reader.result)
      reader.readAsDataURL(file)
    } else {
      setDocumentFile(file)
      // Create preview if it's an image
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => setDocumentPreview(reader.result)
        reader.readAsDataURL(file)
      } else {
        setDocumentPreview(null)
      }
    }
  }

  function handleCancelEdit(section) {
    if (section === 'basic') {
      setIsEditingBasic(false)
    } else if (section === 'address') {
      setIsEditingAddress(false)
    } else if (section === 'contact') {
      setIsEditingContact(false)
    }
    
    // Reset form to original data
    setEditForm({
      name: companyData.name || '',
      main_contact_email: companyData.main_contact_email || '',
      logo_url: companyData.logo_url || '',
      document_url: companyData.document_url || '',
      street_address: companyData.street_address || '',
      town_city: companyData.town_city || '',
      region_county: companyData.region_county || '',
      postal_code: companyData.postal_code || '',
      contact_name: companyData.contact_name || '',
      contact_phone: companyData.contact_phone || '',
      contact_email: companyData.contact_email || ''
    })
    
    setLogoFile(null)
    setLogoPreview(null)
    setDocumentFile(null)
    setDocumentPreview(null)
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading company settings...</p>
        </div>
      </div>
    )
  }

  if (!company || !companyData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Company not found</p>
          <Link href="/company-dashboard" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/company-dashboard" className="text-blue-600 hover:text-blue-800 flex items-center mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to dashboard
        </Link>
        
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Building2 className="w-8 h-8 mr-3 text-gray-600" />
            Company Settings
          </h1>
          <p className="text-gray-600 mt-1">Manage your company information and settings</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-green-800">Success</h3>
            <p className="text-sm text-green-700 mt-1">{success}</p>
          </div>
        </div>
      )}

      {/* Basic Information Card */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Basic Information</h2>
            {!isEditingBasic ? (
              <button
                onClick={() => setIsEditingBasic(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <Edit2 className="w-5 h-5 mr-1" />
                Edit
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSaveSection('basic')}
                  disabled={saving}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleCancelEdit('basic')}
                  disabled={saving}
                  className="flex items-center px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-6 space-y-6">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Company Name</label>
            {isEditingBasic ? (
              <input
                type="text"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            ) : (
              <p className="mt-1 text-gray-900">{companyData.name || 'Not set'}</p>
            )}
          </div>
          
          {/* Main Contact Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              <Mail className="w-4 h-4 inline mr-1" />
              Main Contact Email
            </label>
            {isEditingBasic ? (
              <input
                type="email"
                value={editForm.main_contact_email || ''}
                onChange={(e) => setEditForm({...editForm, main_contact_email: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="General contact email for your company"
              />
            ) : (
              <p className="mt-1 text-gray-900">{companyData.main_contact_email || 'Not set'}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              This is your company's general contact email (different from user login emails)
            </p>
          </div>

          {/* Logo and Document Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ImageIcon className="w-4 h-4 inline mr-1" />
                Company Logo
              </label>
              {isEditingBasic ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {logoPreview || editForm.logo_url ? (
                    <div className="relative">
                      <img
                        src={logoPreview || editForm.logo_url}
                        alt="Company logo"
                        className="h-32 w-32 object-contain mx-auto bg-gray-50 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoFile(null)
                          setLogoPreview(null)
                          setEditForm({...editForm, logo_url: ''})
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e, 'logo')}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      </label>
                      <p className="mt-2 text-xs text-gray-500">
                        PNG, JPG or GIF up to 5MB
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {companyData.logo_url ? (
                    <img
                      src={companyData.logo_url}
                      alt="Company logo"
                      className="h-24 object-contain"
                    />
                  ) : (
                    <p className="text-sm text-gray-500">No logo uploaded</p>
                  )}
                </div>
              )}
            </div>

            {/* Company Document */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Company Document
              </label>
              {isEditingBasic ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {documentPreview || editForm.document_url ? (
                    <div className="relative">
                      {documentPreview || (editForm.document_url && editForm.document_url.match(/\.(jpg|jpeg|png|gif)$/i)) ? (
                        <img
                          src={documentPreview || editForm.document_url}
                          alt="Company document"
                          className="h-32 w-32 object-contain mx-auto bg-gray-50 rounded-lg"
                        />
                      ) : (
                        <div className="h-32 w-32 mx-auto bg-gray-50 rounded-lg flex items-center justify-center">
                          <FileImage className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDocumentFile(null)
                          setDocumentPreview(null)
                          setEditForm({...editForm, document_url: ''})
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileSelect(e, 'document')}
                        className="hidden"
                        id="document-upload"
                      />
                      <label
                        htmlFor="document-upload"
                        className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {uploadingDocument ? 'Uploading...' : 'Upload Document'}
                      </label>
                      <p className="mt-2 text-xs text-gray-500">
                        Certificates, licenses, etc. • Max 5MB
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {companyData.document_url ? (
                    <a
                      href={companyData.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View document
                    </a>
                  ) : (
                    <p className="text-sm text-gray-500">No document uploaded</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Address Information Card */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-gray-600" />
              Address Information
            </h2>
            {!isEditingAddress ? (
              <button
                onClick={() => setIsEditingAddress(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <Edit2 className="w-5 h-5 mr-1" />
                Edit
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSaveSection('address')}
                  disabled={saving}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleCancelEdit('address')}
                  disabled={saving}
                  className="flex items-center px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Street Address</label>
              {isEditingAddress ? (
                <input
                  type="text"
                  value={editForm.street_address || ''}
                  onChange={(e) => setEditForm({...editForm, street_address: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter company street address"
                />
              ) : (
                <p className="mt-1 text-gray-900">{companyData.street_address || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Town/City</label>
              {isEditingAddress ? (
                <input
                  type="text"
                  value={editForm.town_city || ''}
                  onChange={(e) => setEditForm({...editForm, town_city: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter town or city"
                />
              ) : (
                <p className="mt-1 text-gray-900">{companyData.town_city || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Region/County</label>
              {isEditingAddress ? (
                <input
                  type="text"
                  value={editForm.region_county || ''}
                  onChange={(e) => setEditForm({...editForm, region_county: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter region or county"
                />
              ) : (
                <p className="mt-1 text-gray-900">{companyData.region_county || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Postal Code</label>
              {isEditingAddress ? (
                <input
                  type="text"
                  value={editForm.postal_code || ''}
                  onChange={(e) => setEditForm({...editForm, postal_code: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter postal code"
                />
              ) : (
                <p className="mt-1 text-gray-900">{companyData.postal_code || 'Not set'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Information Card */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <User className="w-5 h-5 mr-2 text-gray-600" />
              Contact Information
            </h2>
            {!isEditingContact ? (
              <button
                onClick={() => setIsEditingContact(true)}
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <Edit2 className="w-5 h-5 mr-1" />
                Edit
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSaveSection('contact')}
                  disabled={saving}
                  className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-1" />
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleCancelEdit('contact')}
                  disabled={saving}
                  className="flex items-center px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Contact Name</label>
              {isEditingContact ? (
                <input
                  type="text"
                  value={editForm.contact_name || ''}
                  onChange={(e) => setEditForm({...editForm, contact_name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Primary contact person"
                />
              ) : (
                <p className="mt-1 text-gray-900">{companyData.contact_name || 'Not set'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                <Phone className="w-4 h-4 inline mr-1" />
                Contact Phone
              </label>
              {isEditingContact ? (
                <input
                  type="tel"
                  value={editForm.contact_phone || ''}
                  onChange={(e) => setEditForm({...editForm, contact_phone: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Contact phone number"
                />
              ) : (
                <p className="mt-1 text-gray-900">{companyData.contact_phone || 'Not set'}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                <Mail className="w-4 h-4 inline mr-1" />
                Contact Email
              </label>
              {isEditingContact ? (
                <input
                  type="email"
                  value={editForm.contact_email || ''}
                  onChange={(e) => setEditForm({...editForm, contact_email: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Primary contact email"
                />
              ) : (
                <p className="mt-1 text-gray-900">{companyData.contact_email || 'Not set'}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                This is for the primary contact person (can be different from main company email)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Info (Read-only) */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Subscription Information</h2>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                  companyData.subscription_status === 'active' 
                    ? 'text-green-600 bg-green-50' 
                    : companyData.subscription_status === 'trial'
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 bg-gray-50'
                }`}>
                  {companyData.subscription_status}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Expires</label>
              <p className="mt-1 text-gray-900">
                {companyData.subscription_end_date 
                  ? new Date(companyData.subscription_end_date).toLocaleDateString()
                  : 'Not set'
                }
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Company ID</label>
              <p className="mt-1 text-sm text-gray-500 font-mono">{companyData.id}</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            To manage your subscription or purchase credits, visit the{' '}
            <Link href="/account/subscription" className="text-blue-600 hover:text-blue-800">
              subscription page
            </Link>.
          </div>
        </div>
      </div>
    </div>
  )
}