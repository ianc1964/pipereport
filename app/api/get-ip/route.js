// /app/api/get-ip/route.js
// API route to get the client's real IP address

import { headers } from 'next/headers'

export async function POST() {
  const headersList = headers()
  
  // Check various headers in order of preference
  const forwardedFor = headersList.get('x-forwarded-for')
  const realIP = headersList.get('x-real-ip')
  const cfConnectingIP = headersList.get('cf-connecting-ip')
  
  let ip = '127.0.0.1'
  
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    ip = forwardedFor.split(',')[0].trim()
  } else if (realIP) {
    ip = realIP
  } else if (cfConnectingIP) {
    ip = cfConnectingIP
  }
  
  return Response.json({ ip })
}