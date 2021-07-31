const express = require('express');
const path = require('path')
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
const args = process.argv.slice(2);
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

// Global vars
const signal = false;
let rawconfig = fs.readFileSync('config/config.json');
let resources = JSON.parse(rawconfig);
let firstLoad = true;
let servicesList = [];
let resourcesList = [];
let publicStatuses = {};
let downServices = 0;

let categories = [];
let totalKey = 0;

/**
 * Console log everything unless running in Production mode.
 */
if (process.env.NODE_ENV !== 'production') {
  appLog.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * @void function sendToLog()
 *
 * Sends a message to the program log, given a level and message.  In the default
 * configuration, message with the level "error" are routed to `logs/error.log` and
 * all other messages are routed to `logs/events.log` only.
 *
 * @var String level   - Possible values: "error", "warn", "info", "verbose", or "debug"
 * @var String message - The text to save to the log
 */
function sendToLog(level, message) {
  appLog.log(level, message);
}

/**
 * @void function sendNotification()
 *
 * Sends a notification via Signal-CLI if it is installed AND enabled.  This also
 * sends the message to the logs automatically which is why level is also required.
 * For help enabling this Signal-CLI integration, see
 * https://github.com/funkybunch/UpKeep/wiki/Signal-Integration-Help.
 *
 * By default, this function will use data stored in the `.env` file to determine the
 * recipient, but this can be modified to be as complex and robust as you need.
 *
 * Interfacing with the Signal-CLI application occurs in the `sendViaSignalCLI()` function.
 *
 * @var String level   - Possible values: "error", "warn", "info", "verbose", or "debug"
 * @var String message - The text to send as a notification.
 */
function sendNotification(level, message) {
  appLog.log(level, message);
  if(signal) {
    // sendViaSignalCLI(process.env.SIGNAL_RECIPIENT, message)
  }
}

/**
 * @void function sendViaSignalCLI()
 *
 * Sends a message via SignalCLI.  Signal-CLI must be installed system-wide, otherwise
 * you will receive an error.
 *
 * @var String recipient - The phone number of the Signal user to send the message to.  Make sure to include "+[country code]"
 * @var String message   - The text to send to the recipient
 */
// function sendViaSignalCLI(recipient, message) {
//   if (shell.exec('signal-cli -u ' + process.env.SIGNAL_SENDER + ' send -m "' + message + '" ' + recipient + '').code !== 0) {
//     sendToLog("error", "Failed to send notification via Signal.  Check to make sure Signal-CLI is installed and you are using the correct username.");
//   }
// }

/**
 * @void function loadConfig()
 *
 * Checks the JSON configuration file (config/config.json) for changes and loads
 * the configuration file if changes are detected.  The file will be loaded automatically
 * when the program starts, and then periodically according to the CRON schedule.
 * Default reload interval is 5 minutes.
 *
 * This function has no inputs as it uses and modifies data stored in global variables.
 */
function loadConfig() {
  let newconfig = fs.readFileSync('config/config.json');

  if(firstLoad || Buffer.compare(rawconfig, newconfig) !== 0) {
    servicesList = [];
    resourcesList = [];
    publicStatuses = {};
    downServices = 0;
    categories = [];
    totalKey = 0;

    rawconfig = newconfig;
    resources = JSON.parse(newconfig);
    for(let i = 0; i < resources.categories.length; i++) {
      categories[i] = resources.categories[i].name;

      for(let j = 0; j < resources.categories[i].services.length; j++) {
        servicesList[j] = resources.categories[i].services;
        resourcesList[totalKey] = resources.categories[i].services[j].hostname;
        totalKey++;
      }
    }
    firstLoad = false;
    sendToLog("info", "New configuration loaded.");
  } else {
    sendToLog("info", "No change to configuration file.");
  }
}

/**
 * @void function checkResources()
 *
 * Pings all resources in the configuration file.  Up to 3 attempts per resource will
 * be made (this function is recursive with a maximum depth of 3).  If the 3rd ping
 * attempt fails, the resource status will be set to `down`.  If the resource continues
 * to fail, no change is made to the resource's status.  The resource's status will
 * automatically be changed back to `up` when a subsequent successful ping is made.
 *
 * The `sendNotification()` function is called when the status changes either way.
 *
 * Upon checking all resources, this function calls `publishStatuses()` to publish
 * the results to a web-accessible location.
 *
 * @var String checklist - An array of hostnames to check.
 * @var int attempt      - The attempt number (between 1 & 3) for the resource being actively checked.
 */
async function checkResources(checklist, attempt) {
  checklist.forEach(function(host){
    try {
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
          if(hostStatus === "up" || hostStatus === undefined) {
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
    } catch(e) {
      console.log("Error checking host:", host);
    }
  });

  if(downServices === 0 && attempt === 0) {
    sendToLog("info", "All services responding as expected");
  }
  downServices = 0;
  publishStatuses();
}

/**
 * function getStatus()
 *
 * Checks the status for a given hostname.
 *
 * @var String host - A hostname to check the status of
 * @returns String  - Status of the given resource (either "up" or "down")
 */
function getStatus(host) {
    for(let i = 0; i < resources.categories.length; i++) {
        for(let j = 0; j < resources.categories[i].services.length; j++) {
            if(resources.categories[i].services[j].hostname.match(host)) {
                return resources.categories[i].services[j].status;
            }
        }
    }
}

/**
 * @void function pushStatus()
 *
 * Appends a `status` attribute to the services object given a
 * `hostname` and a `status` (either "up" or "down").  The function
 * will find the correct place to update the status based on the hostname.
 * Because this search is done by hostname, it is important that there are
 * not duplicate hostnames in the `config/config.json` file.
 *
 * @var String host    - A hostname
 * @var String status  - The status of the hostname (either "up" or "down")
 */
function pushStatus(host, status) {
  for(let i = 0; i < resources.categories.length; i++) {
    for(let j = 0; j < resources.categories[i].services.length; j++) {
      if(resources.categories[i].services[j].hostname.match(host)) {
        resources.categories[i].services[j].status = status;
      }
    }
  }
}

/**
 * @void function publishStatuses()
 *
 * Generates and updates the web-accessible JSON file containing the status
 * for all resources.  Once generated, this file is located in `dist/data/status.json`.
 *
 * This function uses and modifies data from global variables and has no inputs.
 */
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
      publicStatuses.categories[i].services[j].url = resources.categories[i].services[j].url;
      publicStatuses.categories[i].services[j].action = resources.categories[i].services[j].action;
    }
  }
  (async () => {
    await writeJSON('./dist/data/status.json', publicStatuses);
  })();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

loadConfig();
checkResources(resourcesList, 0);

cron.schedule('*/5 * * * *', () => {
  loadConfig();
});

cron.schedule('* * * * *', () => {
  checkResources(resourcesList, 0);
  setTimeout(function() {
    try {
      checkResources(resourcesList, 0)
    } catch(e) {
      console.log("Resource Check failed");
    }
  }, 15000);
  setTimeout(function() {
    try {
      checkResources(resourcesList, 0)
    } catch(e) {
      console.log("Resource Check failed");
    }
  }, 30000);
  setTimeout(function() {
    try {
      checkResources(resourcesList, 0)
    } catch(e) {
      console.log("Resource Check failed");
    }
  }, 45000);
});

let indexRouter = require('./routes/index');
let usersRouter = require('./routes/users');

let appServer;
if(args.includes("serve")) {
  console.log("Running as web server");
  appServer = express();

  appServer.use(logger('dev'));
  appServer.use(express.json());
  appServer.use(express.urlencoded({ extended: false }));
  appServer.use(cookieParser());
  appServer.use(sassMiddleware({
    src: path.join(__dirname, 'dist'),
    dest: path.join(__dirname, 'dist'),
    indentedSyntax: true, // true = .sass and false = .scss
    sourceMap: true
  }));
  appServer.use(express.static(path.join(__dirname, 'dist')));

// appServer.use('/', indexRouter);
// appServer.use('/users', usersRouter);

}
module.exports = appServer;
