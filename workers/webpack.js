'use strict';

const Factory = require('../factory');
const walk = require('walk').walk;
const path = require('path');
const resolve = require('resolve');
const fs = require('fs');
const execFile = require('child_process').execFile;

/**
 * Setup factory line.
 *
 * @param {Object} data Builder options, package location etc.
 * @api public
 */
module.exports = function web(data, callback) {
  data.entry = data.entry || 'webpack.config.js';

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
 * Execute webpack build.
 *
 * @param {Function} next Completion callback
 * @returns {void}
 * @api public
 */
module.exports.run = run;

function run(next) {
  const dist = path.join(this.base, 'dist');
  const factory = this;
  const files = {};
  let called = false;

  /**
   * Handle errors from walk.
   *
   * @param {String} root Dirname of file or directory.
   * @param {Object} stat Stat of file or directory, error is attached.
   * @returns {void}
   * @api private
   */
  function errorHandler(root, stat) {
    if (called) return;
    called = true;
    next(stat.error);
  }

  function done() {
    if (called) return;
    called = true;
    next.apply(next, arguments);
  }

  //
  // Read the file from disk and add it to the object that will be returned to
  // the caller
  //
  function read(fullPath, name, cb) {
    fs.readFile(fullPath, 'utf-8', function readFile(err, content) {
      if (err) {
        return void cb(err);
      }

      files[name] = content;
      return void cb();
    });

  }

  webpack({
    base: this.base,
    entry: this.entry,
    env: this.data.env,
    processEnv: this.data.processEnv
  }, function webpacked(error) {
    if (error) {
      return void done(error);
    }

    return void walk(dist)
      .once('nodeError', errorHandler)
      .once('directoryError', errorHandler)
      .once('end', () => done(null, files))
      .on('file', function found(root, file, cb) {
        const filepath = path.join(root, file.name);
        //
        // Run the filter function and if it returns false, dont use that file
        //
        if (!factory.filter(filepath)) return void cb();
        return read(filepath, file.name, cb);
      });
  });
};

/**
 * execFile a child process for the webpack build
 *
 * @param {String} base The path of the project we are building
 * @param {String} config Path to the webpack config file
 * @param {Function} callback Continuation callback
 */
function webpack(opts, callback) {
  const config = opts.entry;
  return resolve('webpack', { basedir: opts.base }, (err, res) => {
    const root = res || require.resolve('webpack');
    const webpackPath = path.join(root, '..', '..', 'bin', 'webpack.js');
    execFile(process.execPath, [webpackPath, '--config', config, '--bail'], {
      cwd: opts.base,
      env: opts.processEnv || process.env // eslint-disable-line
    }, function (err, stdout, stderr) {
      if (err) {
        err.output = stdout + stderr;
        //
        // Rebuild and rerun if the error is special
        //
        if (err.message.includes('npm rebuild')) {
          return rebuild(opts, (err) => {
            if (err) return callback(err);
            webpack(opts, callback);
          });
        }
        return callback(err);
      }
      // TODO: What should we check in the output to determine error? Does
      // webpack output to stderr properly?
      return callback();
    });
  });
}

//
// The most common case is node-sass, in the future we can try and be smart and
// decipher it from the output but until then this will be hardcoded. This
// makes it faster
//
function rebuild(opts, callback) {
  const npmPath = path.join(require.resolve('npm'), '..', '..', 'bin', 'npm-cli.js');
  execFile(process.execPath, [npmPath, 'rebuild', 'node-sass'], {
    cwd: opts.base,
    env: opts.processEnv || process.env
  }, callback);
}
