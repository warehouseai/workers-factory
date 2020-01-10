'use strict';

const Config = require('../minifiers/config');
const assume = require('assume');
const path = require('path');
const toml = require('toml');
const fs = require('fs');

describe('Minifier config', function () {
  it('exposes a class', function () {
    assume(Config).is.a('function');
    assume(Config.prototype.constructor).is.a('function');
  });

  it('stores minification config and output properties', function () {
    assume(new Config()).to.have.property('values');
    assume(new Config({ filename: 'test.js' })).to.have.property('_filename', 'test.js');
  });

  it('normalization adds basic configuration properties', function () {
    const config = new Config({
      filename: 'test.js',
      minify: {
        minifier: 'terser'
      }
    });

    assume(config.values).to.have.property('parse');
    assume(config.values).to.have.property('compress');
    assume(config.values).to.not.have.property('minifier');
    assume(config.values).to.have.deep.property('sourceMap', {
      includeSources: true,
      filename: 'test.min.js',
      url: 'test.min.js.map'
    });
  });

  describe('getters', function () {
    it('are defined on Config', function () {
      ['map', 'terser', 'uglifyjs', 'filename'].forEach(getter => {
        const props = Object.getOwnPropertyDescriptor(Config.prototype, getter);

        assume(props.enumerable).to.be.false();
        assume(props.get).to.be.a('function');
      });
    });

    it('#map: returns filenames of sourceMaps', function () {
      const config = new Config({
        filename: 'test.js'
      });

      assume(config.map).to.equal('test.min.js.map');

      config._filename = 'other.js';
      assume(config.map).to.equal('other.min.js.map');
    });

    it('#terser: returns Terser configuration', function () {
      const config = new Config(
        toml.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'wrhs-es6.toml'))), // eslint-disable-line
      ).terser;

      assume(config).to.be.an('object');
      assume(config).to.not.have.property('minifier', 'terser');
      assume(config.ecma).to.equal(2018);
      assume(config.toplevel).true();
    });

    it('#uglifyjs: returns UglifyJS configuration', function () {
      const config = new Config(
        toml.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'wrhs.toml'))), // eslint-disable-line
      ).uglifyjs;

      assume(config).to.be.an('object');
      assume(config).to.not.have.property('mangleProperties');
      assume(config.mangle).to.have.property('toplevel', true);
      assume(config.parse).to.have.property('bare_returns', true);
      assume(config.mangle.properties.regex).to.be.instanceof(RegExp);
    });
  });
});
