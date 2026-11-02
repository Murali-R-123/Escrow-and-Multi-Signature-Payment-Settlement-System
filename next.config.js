/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // keep native/driver packages out of the client bundle
  experimental: { serverComponentsExternalPackages: ['mysql2', 'mongodb'] },
};
