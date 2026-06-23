/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Пока true — рендерим обычный <img> без оптимизации Next.
    // Перед деплоем на Vercel поставь false, чтобы включить WebP/AVIF и CDN.
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  }
};
export default nextConfig;
