const path = require('node:path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Allow importing from parent directory (the package source)
  transpilePackages: ['agentation'],
};

module.exports = nextConfig;
