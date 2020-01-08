'use strict';

const fingerprinter = require('fingerprinting');
const Config = require('./config.js');
const uglifyjs = require('uglify-js');

/**
 * Minify JS with UglifyJS.
 *
 * @param {Object} options Content (compiled JS) and filepath.
 * @param {Function} done Completion callback.
 * @returns {Undefined} Return early.
 * @public
 */
module.exports = function uglify(options, done) {
  const filename = options.file.replace('.js', '.min.js');
  const config = new Config({
    minify: options.minify,
    sourceMapContent: options.map,
    filename
  });

  const results = uglifyjs.minify(options.content.toString('utf-8'), config.uglifyjs);

  //
  // Return on a minification error.
  //
  if (results.error) {
    return done(results.error);
  }

  //
  // Get hash for content.
  //
  const fingerprint = fingerprinter(options.file, { content: results.code, map: true });

  done(null, {
    content: results.code,
    fingerprint: fingerprint.id,
    filename: filename
  }, {
    [config.map]: {
      content: results.map,
      fingerprint: fingerprint.id
    }
  });
};

