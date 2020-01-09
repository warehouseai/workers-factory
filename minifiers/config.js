const cloneDeep = require('lodash.clonedeep');
const tryParse = require('json-try-parse');
const safe = require('safe-regex');
const rip = require('rip-out');

/**
 * Normalized configuration for various minifiers.
 *
 * @class Config
 * @param {Object} config Minification configuration from wrhs.toml.
 * @param {String} filename Reference to minified filename.
 * @param {String} map Reference to sourcemap url.
 * @public
 */
class Config {
  constructor({ minify, sourceMapContent, filename }) {
    this.filename = filename;

    //
    // Prevent polution of wrhs.toml
    //
    this.values = this.normalize(minify, sourceMapContent);
  }

  /**
   * Normalize configuration to have required set of options.
   *
   * @param {Object} minify base configuration from wrhs.toml.
   * @param {String} sourceMapContent JSON representation of sourceMap.
   * @returns {Object} configuration
   * @public
   */
  normalize(minify = {}, sourceMapContent) {
    const config = cloneDeep(minify);

    config.parse = config.parse || {};
    config.compress = config.compress || {};
    config.sourceMap = config.sourceMap || {};

    if (config.mangle
        && config.mangle.properties
        && config.mangle.properties.regex
        && safe(config.mangle.properties.regex)) {
      config.mangle.properties.regex = new RegExp(config.mangle.properties.regex);
    }

    //
    // Define sourcemap config with:
    //  - filename: reference to minified file the sourcemap maps to
    //  - url: sourcemap url to append to code content
    //
    config.sourceMap.includeSources = true;
    config.sourceMap.filename = this.filename;
    config.sourceMap.url = this.map;

    //
    // Minifier was given sourcemap content as input from earlier minification.
    // Test if the content is valid JSON and add it to the content.
    //
    if (tryParse(sourceMapContent)) {
      config.sourceMap.content = sourceMapContent.toString('utf-8');
    }

    return config;
  }

  /**
   * Return filename of the sourceMap.
   *
   * @returns {String} filename
   * @public
   */
  get map() {
    return `${this.filename}.map`;
  }

  /**
   * Return Terser configuration. Clone to prevent downstream changes to `values`.
   *
   * @returns {Object} configuration
   * @public
   */
  get terser() {
    const config = rip(this.values, 'minifier');

    return cloneDeep(config);
  }

  /**
   * Return UglifyJS configuration. Clone to prevent downstream changes to `values`.
   *
   * @returns {Object} configuration
   * @public
   */
  get uglifyjs() {
    const config = rip(this.values, 'mangleProperties');
    const mangleProperties = config.mangleProperties;

    //
    // Support legacy uglify-js option and transform it to support uglify-js@3
    //
    if (typeof mangleProperties === 'object') {
      if (typeof config.mangle !== 'object') config.mangle = {};
      config.mangle.properties = {
        ...config.mangle.properties,
        ...mangleProperties
      };
    }

    //
    // Provide a few more size restricting defaults.
    //
    config.parse.bare_returns = true;
    config.compress.reduce_vars = true;

    return cloneDeep(config);
  }
}

module.exports = Config;
