module.exports = {
  apps: [
    {
      name: 'own-ai-api',
      cwd: './backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '2G',
      error_file: '../logs/pm2-error.log',
      out_file: '../logs/pm2-out.log',
    },
  ],
};
