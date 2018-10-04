module.exports = {
  devtool: 'source-map',
  context: __dirname,
  entry: './index.js',
  externals: {
    react: 'React'
  },
  module: {
    loaders: [{
      test: /\.jsx?$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'babel'
    }]
  },
  output: {
    path: __dirname + '/dist',
    filename: 'bundle.js'
  }
};
