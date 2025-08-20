/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for better performance
  experimental: {
    // Enable server actions (already used in your app)
    serverActions: {
      allowedOrigins: ['localhost:3000', 'pipereport.ai', '*.vercel.app'],
      bodySizeLimit: '50mb' // For video uploads
    }
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      // Supabase Storage
      {
        protocol: 'https',
        hostname: 'wefokijngmjhhqmvwdbw.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      // AWS S3 (video storage)
      {
        protocol: 'https',
        hostname: 'video-analysis-transcoded.s3.eu-west-2.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'video-analysis-transcoded.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      // Backblaze B2 (image storage)
      {
        protocol: 'https',
        hostname: 'f003.backblazeb2.com',
        port: '',
        pathname: '/file/Drainfo/**',
      },
      // Google Maps tiles
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.gstatic.com',
        port: '',
        pathname: '/**',
      }
    ],
    // Optimize images for web
    formats: ['image/webp', 'image/avif'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers for production
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          }
        ]
      },
      {
        // Allow uploads for API routes
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          }
        ]
      }
    ]
  },

  // Webpack configuration for Canvas and large files
  webpack: (config, { isServer }) => {
    // Handle Canvas module for server-side rendering
    if (isServer) {
      config.externals.push({
        canvas: 'commonjs canvas'
      })
    }

    // Configure for large files and video processing
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    }

    // Optimize bundle splitting
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          aws: {
            test: /[\\/]node_modules[\\/]@aws-sdk[\\/]/,
            name: 'aws-sdk',
            chunks: 'all',
          },
          maps: {
            test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
            name: 'maps',
            chunks: 'all',
          }
        }
      }
    }

    return config
  },

  // Build optimizations
  swcMinify: true,
  
  // Enable compression
  compress: true,

  // PoweredByHeader
  poweredByHeader: false,

  // Generate ETags for better caching
  generateEtags: true,

  // Environment variables validation (optional but recommended)
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_AI_ENABLED: process.env.NEXT_PUBLIC_AI_ENABLED,
    NEXT_PUBLIC_RUNPOD_API_KEY: process.env.NEXT_PUBLIC_RUNPOD_API_KEY,
  },

  // Output configuration for Vercel
  output: 'standalone',

  // TypeScript configuration (since you have @types/react)
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
  }
}

module.exports = nextConfig