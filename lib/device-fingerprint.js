// /lib/device-fingerprint.js
// Client-side device fingerprinting library - FIXED VERSION

/**
 * Device Fingerprinting Library
 * Generates a unique device fingerprint based on various browser and hardware characteristics
 */

class DeviceFingerprint {
  constructor() {
    this.components = {}
    this.confidence = 0
  }

  /**
   * Generate a complete device fingerprint
   * @returns {Promise<{hash: string, components: object, confidence: number}>}
   */
  async generate() {
    console.log('DeviceFingerprint: Starting component collection...')
    
    // Collect all fingerprint components with error handling
    const tasks = [
      this.getScreenFingerprint(),
      this.getCanvasFingerprint(),
      this.getWebGLFingerprint(),
      // Skip audio fingerprint on page load (requires user gesture)
      // this.getAudioFingerprint(),
      this.getBrowserFingerprint(),
      this.getHardwareFingerprint(),
      this.getFontFingerprint(),
      this.getTimezoneFingerprint()
    ]

    await Promise.allSettled(tasks) // Use allSettled to continue even if some fail

    // Calculate confidence score based on number of components collected
    const componentCount = Object.keys(this.components).length
    const maxComponents = 15 // Adjusted since we're skipping audio
    this.confidence = Math.min(componentCount / maxComponents, 1)

    console.log('DeviceFingerprint: Collected components:', componentCount)

    // Generate hash from components
    const hash = await this.generateHash(JSON.stringify(this.components))

    console.log('DeviceFingerprint: Generated hash:', hash)

    return {
      hash,
      components: this.components,
      confidence: this.confidence
    }
  }

  /**
   * Get screen-related fingerprint data
   */
  async getScreenFingerprint() {
    if (typeof window === 'undefined') return

    try {
      this.components.screen = {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        devicePixelRatio: window.devicePixelRatio || 1,
        orientation: window.screen.orientation?.type || 'unknown'
      }

      // Add touch support
      this.components.touchSupport = {
        maxTouchPoints: navigator.maxTouchPoints || 0,
        touchEvent: 'ontouchstart' in window,
        touchStart: 'ontouchstart' in window
      }
    } catch (e) {
      console.warn('Screen fingerprint error:', e)
    }
  }

  /**
   * Generate Canvas fingerprint
   */
  async getCanvasFingerprint() {
    if (typeof document === 'undefined') return

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        this.components.canvas = 'not-supported'
        return
      }

      canvas.width = 200
      canvas.height = 50

      // Draw unique canvas content
      ctx.textBaseline = 'top'
      ctx.font = '14px "Arial"'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('DeviceFingerprint 🚀', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('DeviceFingerprint 🚀', 4, 17)

      // Get canvas data
      const dataURL = canvas.toDataURL()
      this.components.canvas = await this.generateHash(dataURL)

      // Check canvas winding
      ctx.rect(0, 0, 10, 10)
      ctx.rect(2, 2, 6, 6)
      this.components.canvasWinding = ctx.isPointInPath(5, 5, 'evenodd') === false
    } catch (e) {
      console.warn('Canvas fingerprint error:', e)
      this.components.canvas = 'error'
    }
  }

  /**
   * Generate WebGL fingerprint (FIXED)
   */
  async getWebGLFingerprint() {
    if (typeof document === 'undefined') return

    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      
      if (!gl) {
        this.components.webgl = 'not-supported'
        return
      }

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      
      // Safely get WebGL parameters with error handling
      const safeGetParameter = (param) => {
        try {
          return gl.getParameter(param)
        } catch (e) {
          return null
        }
      }

      this.components.webgl = {
        vendor: safeGetParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
        renderer: safeGetParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
        version: safeGetParameter(gl.VERSION),
        shadingLanguageVersion: safeGetParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTextureSize: safeGetParameter(gl.MAX_TEXTURE_SIZE),
        maxViewportDims: safeGetParameter(gl.MAX_VIEWPORT_DIMS)?.toString(),
        redBits: safeGetParameter(gl.RED_BITS),
        greenBits: safeGetParameter(gl.GREEN_BITS),
        blueBits: safeGetParameter(gl.BLUE_BITS),
        alphaBits: safeGetParameter(gl.ALPHA_BITS),
        depthBits: safeGetParameter(gl.DEPTH_BITS),
        stencilBits: safeGetParameter(gl.STENCIL_BITS),
        maxRenderBufferSize: safeGetParameter(gl.MAX_RENDERBUFFER_SIZE),
        maxCombinedTextureImageUnits: safeGetParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
        maxCubeMapTextureSize: safeGetParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
        maxFragmentUniformVectors: safeGetParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
        maxTextureImageUnits: safeGetParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
        maxVaryingVectors: safeGetParameter(gl.MAX_VARYING_VECTORS),
        maxVertexAttribs: safeGetParameter(gl.MAX_VERTEX_ATTRIBS),
        maxVertexTextureImageUnits: safeGetParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
        maxVertexUniformVectors: safeGetParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
        aliasedLineWidthRange: safeGetParameter(gl.ALIASED_LINE_WIDTH_RANGE)?.toString(),
        aliasedPointSizeRange: safeGetParameter(gl.ALIASED_POINT_SIZE_RANGE)?.toString()
      }

      // Get supported extensions
      try {
        const extensions = gl.getSupportedExtensions() || []
        this.components.webglExtensions = await this.generateHash(extensions.join(','))
      } catch (e) {
        this.components.webglExtensions = 'error'
      }
    } catch (e) {
      console.warn('WebGL fingerprint error:', e)
      this.components.webgl = 'error'
    }
  }

  /**
   * Generate Audio fingerprint - SKIPPED on initial load
   * AudioContext requires user gesture to start
   */
  async getAudioFingerprint() {
    // Skip audio fingerprinting on page load to avoid errors
    this.components.audio = 'skipped-no-user-gesture'
    return
  }

  /**
   * Get browser-related fingerprint data
   */
  async getBrowserFingerprint() {
    if (typeof navigator === 'undefined') return

    try {
      this.components.browser = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages ? navigator.languages.join(',') : navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        plugins: this.getPlugins(),
        mimeTypes: this.getMimeTypes(),
        productSub: navigator.productSub,
        vendor: navigator.vendor,
        vendorSub: navigator.vendorSub,
        browserName: this.getBrowserName(),
        browserVersion: this.getBrowserVersion()
      }

      // Add media devices if available
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          this.components.mediaDevices = {
            audioinput: devices.filter(d => d.kind === 'audioinput').length,
            audiooutput: devices.filter(d => d.kind === 'audiooutput').length,
            videoinput: devices.filter(d => d.kind === 'videoinput').length
          }
        } catch (e) {
          this.components.mediaDevices = 'permission-denied'
        }
      }
    } catch (e) {
      console.warn('Browser fingerprint error:', e)
    }
  }

  /**
   * Get hardware-related fingerprint data
   */
  async getHardwareFingerprint() {
    if (typeof navigator === 'undefined') return

    try {
      this.components.hardware = {
        cpuCores: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        connection: this.getConnectionInfo()
      }

      // Battery API (if available) - often restricted
      if ('getBattery' in navigator) {
        try {
          const battery = await navigator.getBattery()
          this.components.battery = {
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
            level: battery.level
          }
        } catch (e) {
          this.components.battery = 'permission-denied'
        }
      }
    } catch (e) {
      console.warn('Hardware fingerprint error:', e)
    }
  }

  /**
   * Get font fingerprint
   */
  async getFontFingerprint() {
    if (typeof document === 'undefined') return

    try {
      const fonts = [
        'monospace', 'sans-serif', 'serif',
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New',
        'Georgia', 'Helvetica', 'Impact', 'Times New Roman', 'Verdana'
      ]

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        this.components.fonts = 'not-supported'
        return
      }

      const text = 'mmmmmmmmmmlli'
      const textSize = '72px'
      const baseFonts = ['monospace', 'sans-serif', 'serif']
      const fontList = []

      const getFontWidth = (font) => {
        ctx.font = `${textSize} ${font}`
        return ctx.measureText(text).width
      }

      // Get base widths
      const baseWidths = {}
      baseFonts.forEach(baseFont => {
        baseWidths[baseFont] = getFontWidth(baseFont)
      })

      // Check each font
      fonts.forEach(font => {
        const detected = baseFonts.some(baseFont => {
          const width = getFontWidth(`'${font}',${baseFont}`)
          return width !== baseWidths[baseFont]
        })
        
        if (detected) {
          fontList.push(font)
        }
      })

      this.components.fonts = await this.generateHash(fontList.join(','))
    } catch (e) {
      console.warn('Font fingerprint error:', e)
      this.components.fonts = 'error'
    }
  }

  /**
   * Get timezone fingerprint
   */
  async getTimezoneFingerprint() {
    try {
      this.components.timezone = {
        offset: new Date().getTimezoneOffset(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    } catch (e) {
      console.warn('Timezone fingerprint error:', e)
      this.components.timezone = 'error'
    }
  }

  /**
   * Get browser plugins
   */
  getPlugins() {
    try {
      if (!navigator.plugins || navigator.plugins.length === 0) return 'none'
      
      const plugins = []
      for (let i = 0; i < Math.min(navigator.plugins.length, 10); i++) { // Limit to 10
        const plugin = navigator.plugins[i]
        plugins.push({
          name: plugin.name,
          description: plugin.description,
          filename: plugin.filename
        })
      }
      
      return plugins.length > 0 ? plugins : 'none'
    } catch (e) {
      return 'error'
    }
  }

  /**
   * Get MIME types
   */
  getMimeTypes() {
    try {
      if (!navigator.mimeTypes || navigator.mimeTypes.length === 0) return 'none'
      
      const mimeTypes = []
      for (let i = 0; i < Math.min(navigator.mimeTypes.length, 10); i++) { // Limit to 10
        const mimeType = navigator.mimeTypes[i]
        mimeTypes.push(mimeType.type)
      }
      
      return mimeTypes.length > 0 ? mimeTypes.join(',') : 'none'
    } catch (e) {
      return 'error'
    }
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    try {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection
      
      if (!connection) return 'unknown'
      
      return {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 'unknown',
        rtt: connection.rtt || 'unknown',
        saveData: connection.saveData || false
      }
    } catch (e) {
      return 'error'
    }
  }

  /**
   * Get browser name
   */
  getBrowserName() {
    try {
      const userAgent = navigator.userAgent
      if (userAgent.indexOf('Firefox') > -1) return 'Firefox'
      if (userAgent.indexOf('SamsungBrowser') > -1) return 'Samsung Internet'
      if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) return 'Opera'
      if (userAgent.indexOf('Trident') > -1) return 'Internet Explorer'
      if (userAgent.indexOf('Edge') > -1) return 'Edge (Legacy)'
      if (userAgent.indexOf('Edg') > -1) return 'Edge'
      if (userAgent.indexOf('Chrome') > -1) return 'Chrome'
      if (userAgent.indexOf('Safari') > -1) return 'Safari'
      return 'Unknown'
    } catch (e) {
      return 'Unknown'
    }
  }

  /**
   * Get browser version
   */
  getBrowserVersion() {
    try {
      const userAgent = navigator.userAgent
      let version = 'Unknown'
      
      const matches = userAgent.match(/(firefox|msie|chrome|safari|opera|edge|edg)[\/\s](\d+)/i)
      if (matches) {
        version = matches[2]
      }
      
      return version
    } catch (e) {
      return 'Unknown'
    }
  }

  /**
   * Generate SHA-256 hash
   */
  async generateHash(str) {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      // Fallback to simple hash for older browsers
      return this.simpleHash(str)
    }

    try {
      const msgBuffer = new TextEncoder().encode(str)
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return hashHex
    } catch (e) {
      return this.simpleHash(str)
    }
  }

  /**
   * Simple hash fallback for older browsers
   */
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }
}

// Export for use in other files
export default DeviceFingerprint