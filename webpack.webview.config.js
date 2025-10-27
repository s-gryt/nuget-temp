const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (_env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    target: 'web',
    mode: argv.mode || 'development',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'webview'),
      filename: isProduction ? 'webview.[contenthash].js' : 'webview.js',
      clean: true,
      publicPath: '',
      // Ensure proper asset handling for VS Code webview
      assetModuleFilename: 'assets/[name].[contenthash][ext]'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@webview': path.resolve(__dirname, 'src/webview'),
        '@components': path.resolve(__dirname, 'src/webview/components'),
        '@styles': path.resolve(__dirname, 'src/webview/styles')
      },
      // Ensure proper module resolution for React
      mainFields: ['browser', 'module', 'main'],
      // Fallback for Node.js modules in browser environment
      fallback: {
        path: false,
        fs: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false
      }
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.webview.json',
                transpileOnly: true, // Skip type checking for now
                compilerOptions: {
                  sourceMap: !isProduction,
                  // Ensure proper JSX compilation
                  jsx: 'react-jsx',
                  target: 'ES2020',
                  module: 'ESNext'
                }
              }
            }
          ]
        },
        {
          test: /\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                sourceMap: !isProduction,
                // Enable CSS modules if needed
                modules: false,
                importLoaders: 0
              }
            }
          ]
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name].[contenthash][ext]'
          }
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name].[contenthash][ext]'
          }
        },
        {
          test: /\.(js)$/i,
          include: path.resolve(__dirname, 'assets'),
          type: 'asset/resource',
          generator: {
            filename: 'bundled-assets/[name].[contenthash][ext]'
          }
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/webview/index.html',
        filename: 'index.html',
        inject: 'body',
        scriptLoading: 'defer',
        minify: isProduction
          ? {
              removeComments: true,
              collapseWhitespace: true,
              removeRedundantAttributes: true,
              useShortDoctype: true,
              removeEmptyAttributes: true,
              removeStyleLinkTypeAttributes: true,
              keepClosingSlash: true,
              minifyJS: true,
              minifyCSS: true,
              minifyURLs: true
            }
          : false
      })
    ],
    devtool: isProduction ? 'source-map' : 'inline-source-map',
    optimization: {
      minimize: isProduction,
      usedExports: true,
      sideEffects: false,
      // Tree shaking configuration
      providedExports: true,
      splitChunks: isProduction
        ? {
            chunks: 'all',
            minSize: 20000,
            maxSize: 250000,
            cacheGroups: {
              default: {
                minChunks: 2,
                priority: -20,
                reuseExistingChunk: true
              },
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendors',
                priority: -10,
                chunks: 'all'
              },
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                name: 'react',
                priority: 10,
                chunks: 'all'
              },
              forceGraph: {
                test: /[\\/]node_modules[\\/](react-force-graph-3d|three)[\\/]/,
                name: 'force-graph',
                priority: 15,
                chunks: 'all'
              }
            }
          }
        : false
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 2000000,
      maxEntrypointSize: 2000000
    },
    stats: {
      errorDetails: true,
      colors: true,
      // Reduce noise in development
      modules: isProduction,
      chunks: isProduction,
      chunkModules: isProduction
    },
    // Ensure proper context for webview
    context: __dirname,
    // Cache configuration for better build performance
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename]
      }
    }
  };
};
