/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No ESLint setup in this project; type-checking still runs during build.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
