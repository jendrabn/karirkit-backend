import debugLib from 'debug';
import http from 'http';
import app from './index';
import env from './config/env.config';

const debug = debugLib('backend:server');
const port = env.port;
app.set('port', port);

const server = http.createServer(app);

server.listen(port, () => {
  debug(`Server listening on port ${port}`);
});
server.on('error', (error) => onError(error));
server.on('listening', () => onListening());

function onError(error: NodeJS.ErrnoException): void {
  if (error.syscall !== 'listen') {
    throw error;
  }

  switch (error.code) {
    case 'EACCES':
      console.error(`Port ${port} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`Port ${port} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening(): void {
  const address = server.address();
  const bind = typeof address === 'string' ? address : address?.port;
  debug(`Listening on ${bind}`);
}
