const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const sassMiddleware = require('node-sass-middleware');
const env = require('dotenv').config();
const fs = require('fs');
const cron = require('node-cron');
const ping = require('ping');
const shell = require('shelljs');
const writeJSON = require('write-json-file');
const winston = require('winston');
const signal = true;
const appLog = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/events.log' })
  ]
});

// Hosts to monitor
let rawconfig = fs.readFileSync('config/config.json');
let resources = JSON.parse(rawconfig);
let servicesList = [];
let resourcesList = [];
let publicStatuses = {};
let downServices = 0;

let categories = [];
let totalKey = 0;

for(let i = 0; i < resources.categories.length; i++) {
  categories[i] = resources.categories[i].name;

  for(let j = 0; j < resources.categories[i].services.length; j++) {
    servicesList[j] = resources.categories[i].services;
    resourcesList[totalKey] = resources.categories[i].services[j].hostname;
    totalKey++;
  }
}

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  appLog.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// appLog.log('info', 'test message %s', 'my string');
function sendToLog(level, message) {
  appLog.log(level, message);
}

function sendNotification(level, message) {
  appLog.log(level, message);
  if(signal) {
    sendViaSignalCLI(process.env.SIGNAL_RECIPIENT, message)
  }
}

function sendViaSignalCLI(recipient, message) {
  if (shell.exec('signal-cli -u ' + process.env.SIGNAL_SENDER + ' send -m "' + message + '" ' + recipient + '').code !== 0) {
    sendToLog("error", "Failed to send notification via Signal.  Check to make sure Signal-CLI is installed and you are using the correct username.");
  }
}

function checkResources(checklist, attempt) {
  checklist.forEach(function(host){
    ping.sys.probe(host, function(isAlive){
      let hostStatus = getStatus(host);
      // Make 3 attempts before logging or sending alert
      if(!isAlive && attempt < 2) {
        checkResources(JSON.parse('[ "' + host + '" ]'), attempt + 1);
        sendToLog("info", "Connection attempt " + (attempt + 1) + " to " + host + " failed.  Retrying...");
      } else if(!isAlive && attempt === 2) {
        pushStatus(host, "down");
        sendToLog("info", "Connection attempt " + (attempt + 1) + " to " + host + " failed.  Retrying...");
        downServices++;
        // Only change status and send log or notification if service was last detected as "up"
        if(hostStatus === "up") {
          sendNotification("warn", "Service " + host + " is down.");
        }
      } else if(isAlive) {
        pushStatus(host, "up");
        // Only change status and send log or notification if service was last detected as "down"
        if(hostStatus === "down") {
          sendNotification("warn", "Service " + host + " is back up.");
        }
      }
    });
  });

  if(downServices === 0 && attempt === 0) {
    sendToLog("info", "All services responding as expected");
  }
  downServices = 0;
  publishStatuses();
}

function getStatus(host) {
    for(let i = 0; i < resources.categories.length; i++) {
        for(let j = 0; j < resources.categories[i].services.length; j++) {
            if(resources.categories[i].services[j].hostname.match(host)) {
                return resources.categories[i].services[j].status;
            }
        }
    }
}

function pushStatus(host, status) {
  for(let i = 0; i < resources.categories.length; i++) {
    for(let j = 0; j < resources.categories[i].services.length; j++) {
      if(resources.categories[i].services[j].hostname.match(host)) {
        resources.categories[i].services[j].status = status;
      }
    }
  }
}

function publishStatuses() {
  publicStatuses.categories = [];
  for(let i = 0; i < resources.categories.length; i++) {
    publicStatuses.categories[i] = {};
    publicStatuses.categories[i].name = resources.categories[i].name;
    publicStatuses.categories[i].services = [];
    for(let j = 0; j < resources.categories[i].services.length; j++) {
      publicStatuses.categories[i].services[j] = {};
      publicStatuses.categories[i].services[j].name = resources.categories[i].services[j].name;
      publicStatuses.categories[i].services[j].status = resources.categories[i].services[j].status;
      publicStatuses.categories[i].services[j].action = resources.categories[i].services[j].action;
    }
  }
  (async () => {
    await writeJSON('./public/data/status.json', publicStatuses);
  })();
}

function checkAll() {
  checkResources(resourcesList, 0);
}

checkAll();
setTimeout(checkAll, 5000);
cron.schedule('* * * * *', () => {
  checkAll();
  setTimeout(checkAll, 15000);
  setTimeout(checkAll, 30000);
  setTimeout(checkAll, 45000);
});

let indexRouter = require('./routes/index');
let usersRouter = require('./routes/users');

let app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(sassMiddleware({
  src: path.join(__dirname, 'public'),
  dest: path.join(__dirname, 'public'),
  indentedSyntax: true, // true = .sass and false = .scss
  sourceMap: true
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

module.exports = app;
