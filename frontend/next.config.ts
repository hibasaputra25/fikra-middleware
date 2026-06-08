import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/siswa", destination: "/siswa/dashboard", permanent: false },
      { source: "/guru", destination: "/guru/dashboard", permanent: false },
      { source: "/admin", destination: "/admin/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
