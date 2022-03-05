import LoggerCls from 'me-logger';

const loggerInstance = new LoggerCls(LoggerCls.Console, { layout: { type: 'pattern', pattern: `%[[%d{yyyy/MM/dd-hh:mm:ss}][%p]%] - %m` } }, 'default');

export default (level: string, msg: string) => loggerInstance[level](`${msg}`);
