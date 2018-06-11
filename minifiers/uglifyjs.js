'use strict';

const fingerprinter = require('fingerprinting');
const tryParse = require('json-try-parse');
const uglifyjs = require('uglify-js');
const safe = require('safe-regex');
const rip = require('rip-out');

/**
 * Minify JS.
 *
 * @param {Object} options Content (compiled JS) and filepath.
 * @param {Function} done Completion callback.
 * @api public
 */
module.exports = function uglify(options, done) {
  let config = options.minify || {};
  const mangleProperties = config.mangleProperties;
  const filename = options.file.replace('.js', '.min.js');
  const map = `${filename}.map`;

  // Support legacy option and transform it to support uglify-js@3
  if (mangleProperties && typeof mangleProperties === 'object') {
    if (!config.mangle || typeof config.mangle === 'boolean') config.mangle = {};
    config.mangle.properties = Object.assign({}, config.mangle.properties, mangleProperties);
  }

  config = rip(config, 'mangleProperties');
  //
  // Mangle can be `true` or an `object`, only change the default if mangle was
  // passed from the `wrhs.toml` configuration.
  //
  if ('mangle' in config) {
    config.mangle = typeof config.mangle === 'object'
      ? Object.assign({}, config.mangle)
      : config.mangle;
  }

  if (config.mangle.properties
      && config.mangle.properties.regex
      && safe(config.mangle.properties.regex)) {
    config.mangle.properties.regex = new RegExp(config.mangle.properties.regex);
  }

  //
  // Provide a few more size restricting defaults and clone the objects to
  // prevent polution of the wrhs.toml.
  //
  config.parse = Object.assign({ bare_returns: true }, config.parse || {});
  config.compress =  Object.assign({ reduce_vars: true }, config.compress || {});

  const sourceMapContent = options.map && tryParse(options.map);
  config.sourceMap = config.sourceMap || {};
  // input sourcemap
  if (sourceMapContent) {
    config.sourceMap.content = sourceMapContent;
  }
  // filename reference of the code that the sourcemap maps to
  config.sourceMap.filename = filename;
  // output sourcemap url to append to code content
  config.sourceMap.url = map;

  const results = uglifyjs.minify(options.content.toString('utf-8'), Object.assign({}, config));

  if (results.error) return done(results.error);

  //
  // Get hash for content. The sourceMap and JS content need to be stored under the same hash.
  //
  const fingerprint = fingerprinter(options.file, { content: results.code, map: true });



  done(null, {
    content: results.code,
    fingerprint: fingerprint.id,
    filename: filename
  }, {
    [map]: {
      content: results.map,
      fingerprint: fingerprint.id
    }
  });
};

