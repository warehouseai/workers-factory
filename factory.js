'use strict';

const EE = require('events').EventEmitter;
const debug = require('diagnostics')('carpenterd:factory');
const cleancss = require('./minifiers/cleancss');
const minimize = require('./minifiers/minimize');
const uglifyjs = require('./minifiers/uglifyjs');
const terser = require('./minifiers/terser');
const fingerprinter = require('fingerprinting');
const extract = require('@wrhs/extract-config');
const rmrf = require('./rmrf');
const mkdirp = require('mkdirp');
const gunzip = require('gunzip-maybe');
const async = require('async');
const tar = require('tar-fs');
const errs = require('errs');
const zlib = require('zlib');
const path = require('path');
const util = require('util');
const fs = require('fs');
const os = require('os');

//
// Map of extensions.
//
const extensions = {
  '.html': '.html',
  '.less': '.css',
  '.styl': '.css',
  '.map': '.map',
  '.css': '.css',
  '.jsx': '.js',
  '.js': '.js'
};

//
// Map of allowed JS minifiers
//
const JSMinifiers = new Map([
  ['default', uglifyjs],
  ['uglifyjs', uglifyjs],
  ['terser', terser]
]);

/**
 * Get the JS minifier/parser based on the configuration.
 *
 * @param {Object} minify Minification options from wrhs.toml
 * @returns {Function} JS minifier.
 * @private
 */
function getJSMinifier({ minify = {} }) {
  return JSMinifiers.has(minify.minifier)
    ? JSMinifiers.get(minify.minifier)
    : JSMinifiers.get('default');
}

util.inherits(Factory, EE);

/**
 * Setup a factory instance that performs the build with the provide runner.
 *
 * @Constructor
 * @param {Object} data Specifications for the build.
 * @param {Function} run Custom build runner.
 * @api public
 */
function Factory(data, run) {
  if (typeof data !== 'object' || typeof run !== 'function' || !data.name) {
    throw new Error('Factory received invalid options');
  }
  EE.call(this);

  //
  // Store build metadata.
  //
  this.base = path.join(data.source, data.id);
  this.dest = data.destDir || path.join(os.tmpdir(), `${data.id}-publish`);

  //
  // Setup any optional filters with our default filter set to run first
  //
  this.filters = (data.filters || [data.filter]).concat([
    (file) => file.indexOf('.min.') === -1
  ]).filter(Boolean).reverse();
  //
  // Default the config to empty
  //
  this.config = { files: {} };
  this.output = {};
  this.data = data;
  this.run = run;

  debug(`Factory process initiated for ${ data.name } mounted on ${ this.dest }`);
}

/**
 * Unpack the provided tarball.
 *
 * @param {Function} next Completion callback.
 * @api public
 */
Factory.prototype.unpack = function unpack(next) {
  const outputPath = path.join(this.data.target, this.data.id);

  //
  // We receive the path to the tarball of the content of package being built
  // from the master process and unpack -> build it as part of our role as the worker
  // process.
  //
  debug(`Unpack ${ this.data.name } to ${ outputPath }`);
  fs.createReadStream(this.data.content)
    .once('error', next)
    .pipe(gunzip()) // eslint-disable-line new-cap
    .once('error', next)
    .pipe(tar.extract(outputPath))
    .once('error', next)
    .once('finish', next);
};

/**
 * Setup factory, read the package.json (safely) and extract the
 * `main` property if required.
 *
 * @param {Function} next Completion callback.
 * @api public
 */
Factory.prototype.init = function init(next) {
  const entry = this.data.entry;
  const base = this.base;
  const factory = this;

  extract(base)
    .then(({ pkg, wrhs }) => {
      debug(`Read configuration: ${ wrhs }`);
      factory.pkg = pkg;
      factory.entry = path.join(base, entry || pkg.main);
      factory.config = wrhs;
    })
    .then(() => next())
    .catch(err => next(err));
};

/**
 * Check if the provided entry file exists.
 *
 * @param {Function} next Completion callback.
 * @api public
 */
Factory.prototype.exists = function exists(next) {
  debug(`Stat entry file ${ this.entry }`);

  fs.stat(this.entry, next);
};

/**
 * Read the entry file. By default this is the `main` property
 * in the package.json.
 *
 * @param {Function} next Completion callback.
 * @api public
 */
Factory.prototype.read = function read(next) {
  const factory = this;

  debug(`Read entry file ${ this.entry }`);
  fs.readFile(factory.entry, 'utf-8', function (error, content) {
    if (error) return void next(error);

    debug('Set `entry` contents on `factory.source`');
    factory.source = content;
    return void next();
  });
};

/**
 * Minify the content, use the extension for content detection.
 *
 * @param {Function} next Completion callback.
 * @returns {void}
 * @api public
 */
Factory.prototype.minify = function minify(next) {
  const factory = this;
  const files = this.output;
  const filenames = Object.keys(files);

  //
  // Build not targetted at production or minify was explicitly denied.
  //
  if (['prod', 'test'].indexOf(factory.data.env) === -1
      || factory.data.minify === false) {
    debug(`Skip minify, env: ${ factory.data.env } and minify flag: ${ factory.data.minify }`);
    return void next();
  }

  debug(`Minifying ${ filenames.length } files`);
  return void async.each(filenames, function each(file, cb) {
    const ext = path.extname(file);
    const options = {
      content: files[file],
      minify: factory.config.minify,
      map: files[`${ file }.map`],
      file
    };

    /**
     * Store the minified CSS/JS/HTML content.
     *
     * @param {Error} error Error returned from minifier
     * @param {String|Buffer} content Minified content.
     * @param {Object} supplementary Optional generated files, e.g. sourcemaps.
     * @returns {void}
     * @api private
     */
    function minified(error, content, supplementary) {
      if (error) return void cb(error);

      factory.stock(content.filename || file, content);

      //
      // Add additional generated files to the factory output.
      //
      if (typeof supplementary === 'object') {
        debug('Store supplementary minified files', supplementary);

        Object.keys(supplementary).forEach(key => {
          factory.stock(key, supplementary[key]);
        });
      }

      return void cb();
    }

    //
    // Only minify known extensions, if unknown skip it.
    //
    debug(`Minify ${ file }`);
    switch (ext) {
      case '.js': getJSMinifier(factory.config)(options, minified); break;
      case '.jsx': getJSMinifier(factory.config)(options, minified); break;
      case '.css': cleancss(options, minified); break;
      case '.less': cleancss(options, minified); break;
      case '.styl': cleancss(options, minified); break;
      case '.html': minimize(options, minified); break;
      default: minified(null, factory.output[file]);
    }
  }, next);
};

/**
 * Run the provided build script.
 *
 * @param {Function} next Completion callback.
 * @api public
 */
Factory.prototype.assemble = function assemble(next) {
  const factory = this;

  debug('Assemble build');

  /**
   * After running store the amount of output files read and convert
   * each file to a Buffer.
   *
   * @param {Error} error
   * @param {String|Array} content Content of each outputted file.
   * @api private
   */
  factory.run(function ran(error, content) {
    if (error) return void next(error);

    for (const file of Object.keys(content)) {
      debug(`Store content of ${ file }`);
      factory.stock(file, content[file]);
    }

    return void next();
  });
};

/**
 * Compress the content of each output file.
 *
 * @param {Function} next Completion callback.
 * @api public
 */
Factory.prototype.pack = function pack(next) {
  const factory = this;

  factory.compressed = {};
  async.each(Object.keys(factory.output), function compress(file, cb) {
    const src = factory.output[file];

    debug(`Compress (gzip) content of ${ file }`);
    zlib.gzip(src.content || src, function done(error, compressed) {
      if (error) return void cb(error);

      factory.compressed[file] = compressed;
      return void cb();
    });
  }, next);
};

/**
 * Clean the temporary directory from disk.
 *
 * @param {Function} next Completion callback.
 * @returns {void}
 * @api public
 */
Factory.prototype.clean = function clean(next) {
  if (!this.data || this.data.clean === false) {
    return void next();
  }

  const id = path.join(this.data.source, this.data.id);
  debug(`Clean build content of ${ id }`);

  return rmrf(id, next);
};

/**
 * Run the filter functions for what files get read
 *
 * @param {String} file that will be assessed by filtering functions
 * @returns {Boolean} Whether this file gets filtered out or not
 * @api public
 */
Factory.prototype.filter = function filt(file) {
  return this.filters.every(fn => {
    return fn(file);
  });
};

/**
 * Run the assembly line with scope series and expose results to the main thread.
 *
 * @param {Array} stack Factory functions to run in order.
 * @param {Function} done Callback function to execute
 * @public
 */
Factory.prototype.line = function line(stack, done) {
  const factory = this;
  const steps = stack.length;

  debug(`Run ${ steps } prepared factory steps`);
  async.eachSeries(stack, function execute(fn, next) {
    debug(`Execute ${ fn.name }`);

    fn.call(factory, function task(error) {
      if (error) return void next(error);

      factory.emit('length', Math.floor(100 / steps));
      factory.emit('task', { message: fn.name, progress: true });

      return void next();
    });
  }, function processed(error) {
    if (error) return void factory.scrap(error, done);

    return void factory.files((err, files) => {
      if (err) return void factory.scrap(err, done);

      debug('Push factory build result');
      factory.emit('store', files);
      done(null, files);
    });
  });
};

/**
 * Write files to disk for uploading to CDN properly
 * XXX: Choose a strategy in the future where we dont read buffers into memory
 * when we don't have to IE when we dont to minify and such
 *
 * @param {Function} fn Continuation function
 * @returns {void}
 * @api private
 */
Factory.prototype.files = function (fn) {
  var factory = this;

  mkdirp(this.dest, (err) => {
    if (err) return fn(err);

    return async.map(Object.keys(factory.output || {}), function map(file, next) {
      const extension = path.extname(file);
      const isSourceMap = extension === '.map';
      const src = factory.output[file];
      const fullPath = path.join(factory.dest, file);

      async.parallel([
        fs.writeFile.bind(fs, fullPath, src.content || src),
        !isSourceMap && fs.writeFile.bind(fs, fullPath + '.gz', factory.compressed[file])
      ].filter(Boolean), (error) => {
        if (error) return fn(error);

        return next(null, {
          content: fullPath,
          compressed: fullPath + '.gz',
          fingerprint: src.fingerprint || fingerprinter(fullPath, { content: src.content || src }).id,
          filename: src.filename || file,
          extension: extensions[extension] || extension
        });
      });
    }, (error, files) => {
      if (error) return fn(error);
      return fn(null, {
        config: factory.config,
        files
      });
    });
  });
};

/**
 * Add a new file to the output of the factory. The content will always be
 * converted to a Buffer to ensure consistency.
 *
 * @param {String} filename Basename of the file.
 * @param {String|Buffer|Object} src File content.
 * @param {String} encoding Content encoding, defaults to utf-8.
 * @api private
 */
Factory.prototype.stock = function stock(filename, src, encoding) {
  encoding = encoding || 'utf-8';

  /**
   * Transform the content to a Buffer;
   *
   * @param {String|Buffer} content File content.
   * @returns {Buffer} Transformed content.
   * @api private
   */
  function buffer(content) {
    return !Buffer.isBuffer(content) ? Buffer.from(content, encoding) : content;
  }

  if (Object.hasOwnProperty.call(src, 'content')) src.content = buffer(src.content);
  else { src = buffer(src); }

  debug(`Adding ${ filename } with content length ${ src.length || src.content.length } to factory stock`);
  this.output[filename] = src;
};

/**
 * Simple error handler, exposes the error to the main thread to
 * acknowledge the user, also exits the child process to allow for retries.
 *
 * @param {Error} error Error from any factory step.
 * @param {Function} done Callback function to execute
 * @private
 */
Factory.prototype.scrap = function scrap(error, done) {
  this.clean(function cleaned(err) {
    if (err) {
      error = errs.merge(error, {
        innerError: err.message,
        event: 'error'
      });
    }

    done(error);
  });
};

//
// Expose the Factory constructor.
//
module.exports = Factory;
