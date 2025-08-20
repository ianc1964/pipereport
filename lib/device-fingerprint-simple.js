// /lib/device-fingerprint-simple.js
// Simplified device fingerprinting for more stable results

class SimpleDeviceFingerprint {
  constructor() {
    this.components = {}
    this.confidence = 0
  }

  async generate() {
    console.log('SimpleDeviceFingerprint: Starting generation...')
    
    // Collect only the most stable components
    await this.getScreenFingerprint()
    await this.getCanvasFingerprint()
    await this.getBrowserFingerprint()
    await this.getTimezoneFingerprint()
    
    // Calculate confidence
    const componentCount = Object.keys(this.components).length
    this.confidence = Math.min(componentCount / 5, 1)
    
    // Create a stable hash from key components
    const stableString = [
      this.components.screen?.width,
      this.components.screen?.height,
      this.components.screen?.colorDepth,
      this.components.canvas,
      this.components.browser?.platform,
      this.components.browser?.language,
      this.components.timezone?.offset,
      this.components.timezone?.timezone
    ].filter(Boolean).join('|')
    
    console.log('Stable fingerprint string:', stableString)
    
    const hash = await this.generateHash(stableString)
    
    console.log('SimpleDeviceFingerprint: Generated hash:', hash)
    
    return {
      hash,
      components: this.components,
      confidence: this.confidence
    }
  }

  async getScreenFingerprint() {
    try {
      this.components.screen = {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio || 1
      }
    } catch (e) {
      console.warn('Screen fingerprint error:', e)
    }
  }

  async getCanvasFingerprint() {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        this.components.canvas = 'not-supported'
        return
      }

      canvas.width = 200
      canvas.height = 50

      // Draw text
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('Canvas fp', 2, 15)
      
      // Get canvas data as string
      const dataURL = canvas.toDataURL()
      // Take only a portion to avoid minor rendering differences
      this.components.canvas = dataURL.substring(50, 200)
    } catch (e) {
      this.components.canvas = 'error'
    }
  }

  async getBrowserFingerprint() {
    try {
      this.components.browser = {
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages?.join(',') || navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0
      }
    } catch (e) {
      console.warn('Browser fingerprint error:', e)
    }
  }

  async getTimezoneFingerprint() {
    try {
      this.components.timezone = {
        offset: new Date().getTimezoneOffset(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    } catch (e) {
      this.components.timezone = { offset: 0, timezone: 'UTC' }
    }
  }

  async generateHash(str) {
    // Simple hash that's consistent
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    
    // Convert to hex and pad to ensure consistent length
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0')
    
    // Add a prefix to make it longer and more unique
    const prefix = 'sfp_' // simple fingerprint
    const suffix = str.length.toString(16).padStart(4, '0')
    
    return `${prefix}${hexHash}_${suffix}`
  }
}

export default SimpleDeviceFingerprint