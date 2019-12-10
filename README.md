# UpKeep
Upkeep is a monitoring agent I built for my homelab, but it could be used to monitor just about anything with an IP address or hostname.

## Installation
UpKeep is still in `beta` so no releases are available at this time.  If you'd still like to take it for a spin:
1. Make sure you have [NodeJS](https://nodejs.org/) installed
2. Set your `working directory` to where you wish to install UpKeep
3. Run `npm install https://github.com/funkybunch/UpKeep.git`
4. Change your `working directory` to UpKeep
5. Setup configuration files (for a quickstart, you can just rename `config/config-sample.json` to `config/config.json` and `.env-sample` to `.env`)
6. Run `npm start`
7. To access the web UI navigate to [http://localhost:3000](http://localhost:3000)

## Features
This was a weekend hack project so I'm sure I'll be adding more to this as time goes on.
1. Easy setup using a JSON config file.
2. CRON-based task scheduling.
3. Integrates with [Signal-CLI](https://github.com/AsamK/signal-cli) to notify you via [Signal](https://signal.org/) if anything goes down.
4. Available as a Docker image [Planned, not finished]

## How it works
UpKeep uses Internet Control Message Protocol ([https://en.wikipedia.org/wiki/Internet_Control_Message_Protocol](ICMP)) to detect if a service is responding at a specific `hostname` or Internet Protocol (`IP`) address.  If you're here reading this, you're probably familiar with this by a simpler name, [Ping](https://en.wikipedia.org/wiki/Ping_(networking_utility)).  **Your services must be 'pingable' for this utility to work.**

This is not some super advanced monitoring tool that checks to make sure your services are responding _correctly_, but simply checks to see if the service is alive.

Configuration is done via a simple JSON file (example included).  This file is loaded when the application is started and checked periodically for changes.  Changes will be loaded automatically when detected.  If a ping fails, two more attempts will be made before marking the service as down (3 attempts total).  UpKeep keeps track of each service and its status.  Upon a change in the status, the event will be logged and if you are using the [Signal Integration](#Signal-Integration) a notification will be sent.  To avoid spamming you, a log entry and notification are only made in 2 cases:
1. When a service goes down
2. When a service comes back up

## Signal Integration
If you use [Signal](https://signal.org/), you can have UpKeep message you via the Signal App when something goes wrong.  UpKeep can interface with [Signal-CLI](https://github.com/AsamK/signal-cli) out of the box.

Full details on how to set this up [on the wiki](https://github.com/funkybunch/UpKeep/wiki/Signal-Integration-Help).

## Logging
This application uses [Winston](https://github.com/winstonjs/winston) for logging.  The log files are stored in {App Directory}/logs/ and are in JSON format.  You can configure logging with Winston in the `app.js` file to suit your needs.

Please keep in mind that excess logging may be in place while this project is in development.

## License
This software is open source under the [MIT License](https://github.com/funkybunch/UpKeep/blob/master/LICENSE).
