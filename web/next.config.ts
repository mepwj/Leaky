import type { NextConfig } from 'next';
import path from 'node:path';

const API_BACKEND_URL =
  process.env.API_BACKEND_URL?.trim() || 'http://mepwj.iptime.org:3000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
