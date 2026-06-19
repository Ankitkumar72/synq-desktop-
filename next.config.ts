import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});



import path from "path";

const distDir = process.env.NEXT_DIST_DIR?.trim()

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
  serverExternalPackages: ['yjs'],
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
  transpilePackages: ['@tiptap/extension-collaboration', '@tiptap/react', '@tiptap/starter-kit'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: path.resolve(__dirname, './node_modules/yjs/dist/yjs.mjs'),
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      yjs: './node_modules/yjs/dist/yjs.mjs',
    },
  },
};

import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default bundleAnalyzer(withSerwist(nextConfig));
