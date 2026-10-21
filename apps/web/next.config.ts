import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The locale layout is the root layout, so a top-level app/page.tsx would have no root layout.
  async redirects() {
    return [{ source: '/', destination: '/en', permanent: false }];
  },
};
export default nextConfig;
