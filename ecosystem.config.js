module.exports = {
  apps: [
    {
      name: 'aurikrex-central',
      script: 'dist/src/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
