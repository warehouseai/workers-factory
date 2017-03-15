'use strict';

const Factory = require('../factory');
const babel = require('babel-core');
const path = require('path');

/**
 * Setup factory line.
 *
 * @param {Object} data Builder options, package location etc.
 * @api public
 */
module.exports = function bab(data, callback) {
  const factory = new Factory(data, run);

  factory.line([
    factory.unpack,
    factory.init,
    factory.exists,
    factory.read,
    factory.assemble,
    factory.minify,
    factory.pack,
    factory.clean
  ], callback);

  return factory;
};


/**
 * Execute es6 build.
 *
 * @param {Function} next Completion callback
 * @api public
 */
module.exports.run = run;

function run(next) {
  const output = {};

  output[path.basename(this.entry)] = babel.transform(this.source, {
    presets: ['babel-preset-es2015', 'babel-preset-react']
  }).code;

  next(null, output);
};
