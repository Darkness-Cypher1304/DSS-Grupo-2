/** @type {import('next').NextConfig} */
const nextConfig = {
  // Modo standalone: genera servidor autocontenido para Docker en producción.
  // Reduce el tamaño de la imagen de ~1GB → ~200MB.
  output: 'standalone',

  reactStrictMode: true,
  poweredByHeader: false, // OWASP A05: ocultar X-Powered-By
  productionBrowserSourceMaps: false,

  // Permitir imágenes externas si las necesitamos
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  // Headers de seguridad como segunda capa (Nginx ya los pone en prod)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
