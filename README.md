# `workers-factory`

[![Version npm](https://img.shields.io/npm/v/workers-factory.svg?style=flat-square)](https://www.npmjs.com/package/workers-factory)
[![License](https://img.shields.io/npm/l/workers-factory.svg?style=flat-square)](https://github.com/warehouseai/workers-factory/blob/master/LICENSE)
[![npm Downloads](https://img.shields.io/npm/dm/workers-factory.svg?style=flat-square)](https://npmcharts.com/compare/workers-factory?minimal=true)
[![Build Status](https://travis-ci.org/warehouseai/workers-factory.svg?branch=master)](https://travis-ci.org/warehouseai/workers-factory)
[![Dependencies](https://img.shields.io/david/warehouseai/workers-factory.svg?style=flat-square)](https://github.com/warehouseai/workers-factory/blob/master/package.json)

Utility functions to bundle and generate assets that can be served over the
web.

## Install

```sh
$ npm install workers-factory --save
```

## Usage

```js
const Factory = require('workers-factory');

//
// Run a webpack build
//
Factory.webpack(options, (err, files) => {
  // returns an array of files that were output.
});
```

## API

We assume `content` is a path to a fully built (`npm install`ed) `tar.gz`.

## Test

```sh
npm test
```
