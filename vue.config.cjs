const fs = require('fs');
const path = require('path');
const { defineConfig } = require('@vue/cli-service');

function envFromFile() {
  const file = path.join(__dirname, '.env');
  const out = {};
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i <= 0) continue;
      out[trimmed.slice(0, i)] = trimmed.slice(i + 1).trim();
    }
  } catch {
    /* no .env */
  }
  return out;
}

const fileEnv = envFromFile();
const proxyTarget = (
  process.env.FUNCTIONS_PROXY ||
  fileEnv.FUNCTIONS_PROXY ||
  process.env.PUBLIC_BASE_URL ||
  fileEnv.PUBLIC_BASE_URL ||
  ''
).replace(/\/$/, '');

function isLocalTunnel(target) {
  try {
    const host = new URL(target).hostname;
    return (
      host.endsWith('.ngrok-free.app') ||
      host.endsWith('.ngrok.io') ||
      host.endsWith('.ngrok.app')
    );
  } catch {
    return false;
  }
}

const proxy =
  proxyTarget && !isLocalTunnel(proxyTarget)
    ? {
        '/widget/config': { target: proxyTarget, changeOrigin: true },
        '/admin/api': { target: proxyTarget, changeOrigin: true },
        '/health': { target: proxyTarget, changeOrigin: true },
      }
    : {};

module.exports = defineConfig({
  transpileDependencies: ['element-plus'],
  outputDir: 'dist',
  publicPath: '/',
  productionSourceMap: false,
  devServer: {
    host: '0.0.0.0',
    port: 8787,
    allowedHosts: 'all',
    proxy,
    setupMiddlewares(middlewares, devServer) {
      if (!Object.keys(proxy).length) {
        const env = { ...fileEnv, ...process.env };
        middlewares.unshift({
          name: 'sss-local-api',
          middleware: (req, res, next) => {
            import('./src/devApi.js')
              .then((mod) => mod.handleNode(req, res, next, env))
              .catch(next);
          },
        });
      }
      return middlewares;
    },
  },
});
