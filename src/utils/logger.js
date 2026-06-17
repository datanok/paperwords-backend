const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const getLogLevel = () => {
  const level = process.env.LOG_LEVEL || 'info';
  return LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
};

const currentLogLevel = getLogLevel();

const log = (level, message, data = {}) => {
  if (LOG_LEVELS[level] >= currentLogLevel) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...data };
    console.log(JSON.stringify(logEntry));
  }
};

module.exports = {
  debug: (message, data) => log('DEBUG', message, data),
  info: (message, data) => log('INFO', message, data),
  warn: (message, data) => log('WARN', message, data),
  error: (message, data) => log('ERROR', message, data),
};
