import fs from 'fs';
import path from 'path';
import pino from 'pino';

const LOG_DIR = path.join(process.cwd(), 'logs');

// Crear carpeta de logs si no existe
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logger = pino({
  name: 'MYSA_LOGGER',
  level: 'info',
  transport: {
    targets: [
      {
        target: 'pino/file',
        options: { destination: path.join(LOG_DIR, 'app.log') },
        level: 'info',
      },
      {
        target: 'pino-pretty',
        options: { colorize: true },
        level: 'info',
      },
    ],
  },
});

export default logger;
