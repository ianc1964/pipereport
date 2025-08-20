// lib/video/storage/storage-interface.js

/**
 * Abstract Storage Interface
 * Defines the contract that all storage providers must implement
 */

export class StorageProvider {
  constructor(config) {
    this.config = config
  }

  /**
   * Initialize the storage provider
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by storage provider')
  }

  /**
   * Get upload URL and any required headers/data for direct browser upload
   * @param {Object} params - Upload parameters
   * @param {string} params.fileName - Name of the file
   * @param {string} params.contentType - MIME type of the file
   * @param {number} params.contentLength - Size of the file in bytes
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Upload configuration
   */
  async getUploadConfig(params) {
    throw new Error('getUploadConfig() must be implemented by storage provider')
  }

  /**
   * Upload a file directly (server-side upload)
   * @param {File|Buffer} file - File to upload
   * @param {string} path - Storage path
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result with URL
   */
  async upload(file, path, options = {}) {
    throw new Error('upload() must be implemented by storage provider')
  }

  /**
   * Delete a file
   * @param {string} path - File path to delete
   * @returns {Promise<boolean>} Success status
   */
  async delete(path) {
    throw new Error('delete() must be implemented by storage provider')
  }

  /**
   * Get a signed URL for temporary access
   * @param {string} path - File path
   * @param {number} expiresIn - Expiration time in seconds
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(path, expiresIn = 3600) {
    throw new Error('getSignedUrl() must be implemented by storage provider')
  }

  /**
   * Check if a file exists
   * @param {string} path - File path
   * @returns {Promise<boolean>} Exists status
   */
  async exists(path) {
    throw new Error('exists() must be implemented by storage provider')
  }

  /**
   * Get file metadata
   * @param {string} path - File path
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata(path) {
    throw new Error('getMetadata() must be implemented by storage provider')
  }

  /**
   * List files in a directory
   * @param {string} prefix - Directory prefix
   * @param {Object} options - List options
   * @returns {Promise<Array>} List of files
   */
  async list(prefix, options = {}) {
    throw new Error('list() must be implemented by storage provider')
  }
}

/**
 * Storage provider types
 */
export const StorageProviders = {
  SUPABASE: 'supabase',
  BACKBLAZE_B2: 'backblaze-b2',
  AWS_S3: 'aws-s3'
}

/**
 * Upload result interface
 */
export class UploadResult {
  constructor({
    url,
    path,
    size,
    contentType,
    metadata = {},
    provider
  }) {
    this.url = url
    this.path = path
    this.size = size
    this.contentType = contentType
    this.metadata = metadata
    this.provider = provider
    this.uploadedAt = new Date().toISOString()
  }
}

/**
 * Upload configuration for direct browser uploads
 */
export class UploadConfig {
  constructor({
    url,
    method = 'POST',
    headers = {},
    fields = {},
    maxSize,
    expires,
    conditions = []
  }) {
    this.url = url
    this.method = method
    this.headers = headers
    this.fields = fields
    this.maxSize = maxSize
    this.expires = expires
    this.conditions = conditions
  }
}