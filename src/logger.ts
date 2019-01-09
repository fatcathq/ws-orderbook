import { createLogger, format, transports } from 'winston'
import fs from 'fs'
import path from 'path'

const { combine, timestamp, prettyPrint, simple, colorize } = format

const logDir = 'logs'
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir)
}

const simpleFileLogFormat = combine(
  timestamp(),
  simple()
)

const verboseFileLogFormat = combine(
  timestamp(),
  prettyPrint()
)

const logger = createLogger({
  transports: [
    new transports.File({ format: verboseFileLogFormat, filename: path.join(logDir, '/error.log'), level: 'error' }),
    new transports.File({ format: verboseFileLogFormat, filename: path.join(logDir, '/warn.log'), level: 'warn' }),
    new transports.File({ format: simpleFileLogFormat, filename: path.join(logDir, '/combined.log') })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      colorize(),
      simple()
    )
  }))

  if (process.env.DEBUG) {
    logger.add(new transports.Console({
      format: combine(
        colorize(),
        simple()
      ),
      level: 'debug'
    }))
  }
}

export default logger
