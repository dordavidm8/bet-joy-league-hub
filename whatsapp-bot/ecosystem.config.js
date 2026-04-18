module.exports = {
  apps: [{
    name: 'kickoff-wa-bot',
    script: 'bot.js',
    cwd: './whatsapp-bot',
    max_memory_restart: '400M',
    restart_delay: 5000,
    max_restarts: 10,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
