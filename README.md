# workers-factory

A few functions to run builds on front end code. We assume `content` is a path
to a fully built (`npm install`ed) `tar.gz`.

## Install

```sh
$ npm install workers-factory --save
```

## Usage

```js
var Factory = require('workers-factory');

//
// Run a webpack build
//
Factory.webpack(options, (err, files) => {
  // returns an array of files that were output.
});
```

