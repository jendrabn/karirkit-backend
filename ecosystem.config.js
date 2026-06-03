module.exports = {
    apps: [{
        name: 'karirkit-backend',
        script: 'dist/server.js',
        interpreter: process.env.BUN_BIN || `${process.env.HOME}/.bun/bin/bun`,
        cwd: '/var/www/karirkit-backend',
        env: { NODE_ENV: 'production', PORT: 3000 }
    }]
};
