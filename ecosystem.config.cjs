// pm2 sozlamasi: server yiqilsa o'zi qayta yoqadi, VPS qayta ishga tushsa ham ishga tushadi.
//   pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [{
    name: 'tashrif',
    script: 'src/server.js',
    node_args: '--disable-warning=ExperimentalWarning',
    env: { NODE_ENV: 'production', HOST: '127.0.0.1' },   // faqat Caddy orqali kiriladi
    max_memory_restart: '500M',
    time: true,                                           // jurnalga vaqt qo'shadi
    kill_timeout: 5000,
    autorestart: true,
    exp_backoff_restart_delay: 200,
  }],
};
