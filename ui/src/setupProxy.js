'use strict';

const {createProxyMiddleware} = require('http-proxy-middleware');

console.log('setupProxy for development reactjs');

// See https://create-react-app.dev/docs/proxying-api-requests-in-development/
// See https://create-react-app.dev/docs/proxying-api-requests-in-development/#configuring-the-proxy-manually
module.exports = function (app) {
  // Proxy the api to Go API server.
  const host = process.env.API_HOST || '127.0.0.1';
  const port = process.env.LISTEN || 2023;
  app.use('/tc/api/v1/', createProxyMiddleware({target: `http://${host}:${port}/`}));
};

