import type { NextConfig } from "next";

import path from "path";

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  transpilePackages: ['yjs', '@tiptap/extension-collaboration', '@tiptap/react', '@tiptap/starter-kit'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: path.resolve(__dirname, 'node_modules/yjs/dist/yjs.mjs'),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      yjs: './node_modules/yjs/dist/yjs.mjs',
    },
  },
};

export default nextConfig;
