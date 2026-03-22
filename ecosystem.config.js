module.exports = {
  apps: [
    {
      name: 'tcgdex-image-intake',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/tcgdex-image-intake/error.log',
      out_file: '/var/log/tcgdex-image-intake/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
