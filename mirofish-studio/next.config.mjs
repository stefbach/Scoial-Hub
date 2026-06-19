/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build autonome : génère un serveur Node minimal copiable dans une image Docker.
  output: "standalone",
};

export default nextConfig;
