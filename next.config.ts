import type {NextConfig} from 'next';

// Attempt to explicitly load .env.local for development environments
if (process.env.NODE_ENV === 'development') {
  console.log(`[${new Date().toISOString()}] [next.config.ts] Attempting to load .env.local using dotenv...`);
  try {
    const dotenvResult = require('dotenv').config({ path: '.env.local' });
    if (dotenvResult.error) {
      console.error(`[${new Date().toISOString()}] [next.config.ts] dotenv error loading .env.local:`, dotenvResult.error.message);
    } else {
      console.log(`[${new Date().toISOString()}] [next.config.ts] .env.local loaded via dotenv. Parsed variables:`, Object.keys(dotenvResult.parsed || {}));
      if (process.env.MONGODB_URI) {
        console.log(`[${new Date().toISOString()}] [next.config.ts] MONGODB_URI IS available after dotenv load.`);
      } else {
        console.warn(`[${new Date().toISOString()}] [next.config.ts] MONGODB_URI IS STILL NOT available after dotenv load. Please check .env.local content and location.`);
      }
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] [next.config.ts] Exception during dotenv configuration:`, e instanceof Error ? e.message : String(e));
  }
} else {
    console.log(`[${new Date().toISOString()}] [next.config.ts] Not in development, skipping explicit dotenv load for .env.local (Next.js handles this for other .env files in production builds/hosting).`);
}


const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;