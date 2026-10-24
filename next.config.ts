import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Las pruebas e2e usan su propio directorio de build para no chocar con otro `next dev` del mismo proyecto.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
