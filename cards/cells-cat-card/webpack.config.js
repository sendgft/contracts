const sharedJS = require('@sendgft/shared.js')
const FixStyleOnlyEntriesPlugin = require("webpack-fix-style-only-entries")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path')

module.exports = {
  mode: "production",
  entry: {
    main: "./src/index.ts",
    style: "./src/index.scss",
  },
  output: {
    path: path.resolve(__dirname, './public/card'),
    filename: "[name].js"
  },
  resolve: {
    extensions: [".ts"],
  },
  module: {
    rules: [
      {
        test: /\.(jpg|png|gif|svg)$/,
        loader: 'image-webpack-loader',
        // Specify enforce: 'pre' to apply the loader
        // before url-loader/svg-url-loader
        // and not duplicate it in rules with them
        enforce: 'pre'
      },
      {
        test: /\.s[ac]ss$/i,
        use: [ 
          MiniCssExtractPlugin.loader, 
          "css-loader", 
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                config: path.resolve(__dirname, 'postcss.config.js'),
              },
            },          
          },
          "postcss-loader", 
          "sass-loader" 
        ],
      },
      {
        test: /\.ts$/,
        loader: "ts-loader"
      },
    ]
  },
  plugins: [
    new FixStyleOnlyEntriesPlugin(),
    new MiniCssExtractPlugin(),
    new HtmlWebpackPlugin({
      inject: true,
      hash: false,
      filename: 'index.html',
      template: 'src/index.html',
      urlToSharedJs: sharedJS.url,
    }),
  ]  
}