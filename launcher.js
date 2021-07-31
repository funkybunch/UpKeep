const fs = require('fs');
const path = require('path');
const env = require('dotenv').config();
const { spawn } = require('child_process');

const args = process.argv.slice(2);

function spawnProcess(cmd, args) {
    const process = spawn(cmd, args, {stdio: ['inherit']});
    process.stdout.on('data', function(data) {
        console.log(data.toString());
    });
    process.stderr.on('data', function(data) {
        console.log('stderr: ' + data.toString());
    });
    process.on('exit', function(code) {
        console.log('child process exited with code ' + code.toString());
    })
}

// Functions
function startWatcher() {
    spawnProcess('npm', ['run', 'start:watcher']);
}

function startNativeApp() {
    spawnProcess('electron', ['.']);
}

startWatcher();
startNativeApp();
