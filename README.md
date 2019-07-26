# `workers-factory`

[![Version npm](https://img.shields.io/npm/v/workers-factory.svg?style=flat-square)](https://www.npmjs.com/package/workers-factory)
[![License](https://img.shields.io/npm/l/workers-factory.svg?style=flat-square)](https://github.com/warehouseai/workers-factory/blob/master/LICENSE)
[![npm Downloads](https://img.shields.io/npm/dm/workers-factory.svg?style=flat-square)](https://npmcharts.com/compare/workers-factory?minimal=true)
[![Build Status](https://travis-ci.org/warehouseai/workers-factory.svg?branch=master)](https://travis-ci.org/warehouseai/workers-factory)
[![Dependencies](https://img.shields.io/david/warehouseai/workers-factory.svg?style=flat-square)](https://github.com/warehouseai/workers-factory/blob/master/package.json)

Utility functions to bundle and generate assets that can be served over the
web. The workers and minifiers are used by [`carpenterd-worker`][worker] to
generate builds for [Warehouse.ai].

## Install

```sh
npm install workers-factory --save
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

We assume `options.content` is a path to a fully built (`npm install`ed)
`tar.gz`.

## API

Worker will trigger the factory to go through the following methods
in series. The factory line will always have to complete in full for
a build to be considered done.

| Factory step | Execution                                   |
| ------------ | ------------------------------------------- |
| `unpack`     | Untar the contents of the tarball           |
| `init`       | Read `package.json` and configure factory   |
| `exists`     | Check if entry file exists                  |
| `read`       | Read the entry file                         |
| `assemble`   | Execute the builder implemented `run`       |
| `minify`     | Minify the content for `env={ test, prod }` |
| `pack`       | Create a tarball of contents                |
| `clean`      | Remove temporary build directory            |

_Note: `Factory.assemble` will execute the exported `run` function from each worker.
It will callback the next step in the chain with a `Buffer` of content if
it completes without errors._

### Workers

- **Browserify**: Create a bundle using [Browserify]. Configured
  through `package.json#browserify` the content is passed to  the
  `browserify.bundle` method.
- **Webpack**: Will read `webpack.config.js` from tarball content and
  execute the bundled [Webpack] to generate a build of assets.

### Minification

Based on the file extension one of the following minifiers is available to
minify the asset content.

- **CleanCSS**: Minifies CSS using [CleanCSS], special comments are removed
  and a sourcemap is generated by default.
- **Minimize**: Minifies HTML using [minimize].
- **Uglifyjs**: Minify JS using [Uglifyjs]. Configuration can be provided
  through [`wrhs.toml`][whrs.toml] using the `minify` property.

## Test

```sh
npm test
```

[worker]: https://github.com/godaddy/carpenterd-worker
[Warehouse.ai]: https://github.com/godaddy/warehouse.ai/
[Browserify]: http://browserify.org/
[Webpack]: https://webpack.js.org/
[Babel]: https://babeljs.io/
[CleanCSS]: https://www.cleancss.com/
[Minimize]: https://github.com/Swaagie/minimize
[Uglifyjs]: https://github.com/mishoo/UglifyJS2
[whrs.toml]: https://github.com/godaddy/carpenterd#wrhstoml
