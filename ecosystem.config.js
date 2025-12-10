module.exports = {
    apps: [{
        name: 'karirkit-backend',
        script: 'dist/server.js',
        cwd: '/var/www/karirkit-backend',
        env: { NODE_ENV: 'production', PORT: 3000 }
    }]
};