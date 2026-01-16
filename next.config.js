/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep ESM module type
  experimental: {
    // Ensure we can use ESM imports
  },
  // Preserve existing static assets
  output: 'standalone',
};

export default nextConfig;
