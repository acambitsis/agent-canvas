/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence ESLint circular reference warning during builds
  // (caused by FlatCompat + Next.js config interaction)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
