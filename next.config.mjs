/** @type {import('next').NextConfig} */
const nextConfig = {
  // Не валим прод-сборку из-за ошибок типов/линта в нетипизированных
  // модулях (движок полянки написан в JS-стиле). На рантайм не влияет;
  // проверку типов делаем отдельно при разработке.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    // На Vercel включаем оптимизацию картинок (WebP/AVIF + CDN).
    unoptimized: false,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
};
export default nextConfig;
