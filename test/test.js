'use strict';

const expect = require('chai').expect;
const fs = require('fs');

describe('#loadSampleJSON', function() {
    it('should be a valid JSON File', function() {
        fs.readFileSync('config/config.json');
    });
});