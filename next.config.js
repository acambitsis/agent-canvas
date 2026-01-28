/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence ESLint circular reference warning during builds
  // (caused by FlatCompat + Next.js config interaction)
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Tree-shake barrel imports for lucide-react to reduce bundle size
    // (imports ~1500 icons but only ~30 are used)
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
