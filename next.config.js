/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Configurações de imagens (mantidas)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
        pathname: '/**',
      },
    ],
  },

  // Habilita Turbopack de forma explícita
  turbopack: {
    // Exemplo: se quiser definir aliases customizados
    resolveAlias: {
      '@': './src',
    },
  },

  // 'transpilePackages' deve ficar na raiz do config
  transpilePackages: ['@clerk/nextjs'],
};

module.exports = nextConfig;
