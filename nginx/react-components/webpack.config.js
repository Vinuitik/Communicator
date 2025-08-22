const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    groupSocial: './src/groupSocial/index.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    publicPath: '/react/',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          process.env.NODE_ENV === 'production' 
            ? MiniCssExtractPlugin.loader 
            : 'style-loader',
          {
            loader: 'css-loader',
            options: { importLoaders: 1 }
          },
          'postcss-loader'
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/groupSocial/template.html',
      filename: 'groupSocial.html',
      chunks: ['groupSocial']
    }),
    ...(process.env.NODE_ENV === 'production' 
      ? [new MiniCssExtractPlugin({ filename: '[name].css' })] 
      : [])
  ],
  resolve: {
    extensions: ['.js', '.jsx']
  },
  devServer: {
    static: path.join(__dirname, 'dist'),
    port: 3000,
    hot: true
  }
};
