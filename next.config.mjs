/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/resources/:path*',
        destination: '/api/resources/:path*',
      },
    ]
  },
}

export default nextConfig
