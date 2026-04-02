module.exports = {
  apps: [
    {
      name: "versiongate-api",
      script: "src/server.ts",
      interpreter: "bun",
      watch: false,
      env: { NODE_ENV: "production" },
    },
    {
      name: "versiongate-worker",
      script: "src/worker/index.ts",
      interpreter: "bun",
      watch: false,
      instances: 1,
      env: { NODE_ENV: "production" },
    },
  ],
};
