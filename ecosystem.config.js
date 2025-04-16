module.exports = {
  apps: [{
    name: "leia-analytics-api",
    script: "src/app.js",
    env: {
      NODE_ENV: "production",
      PORT: 3002
    },
    instances: 1,
    exec_mode: "fork",
    watch: false,
    max_memory_restart: "300M",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
};
