/** @type {import('next').NextConfig} */
const nextConfig = {
  // 内网部署场景下关闭图片优化以减少依赖
  images: {
    unoptimized: true,
  },
  // 实验性功能：服务端 actions
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
