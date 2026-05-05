const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'authflow-pa-api' },
  transports: [
    new winston.transports.Console({
      format: config.isDev
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length > 1
                ? ` ${JSON.stringify(meta, null, 0)}`
                : '';
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            })
          )
        : winston.format.json(),
    }),
  ],
});

module.exports = logger;
