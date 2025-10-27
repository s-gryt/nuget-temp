const path = require('path');

module.exports = (_env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    target: 'node',
    mode: argv.mode || 'development',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
      clean: true,
      // Ensure proper module exports for VS Code extension
      library: {
        type: 'commonjs2'
      }
    },
    externals: {
      vscode: 'commonjs vscode',
      // Exclude Node.js built-in modules
      child_process: 'commonjs child_process',
      fs: 'commonjs fs',
      path: 'commonjs path',
      util: 'commonjs util',
      os: 'commonjs os'
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@types': path.resolve(__dirname, 'src/types'),
        '@providers': path.resolve(__dirname, 'src/providers'),
        '@services': path.resolve(__dirname, 'src/services'),
        '@webview': path.resolve(__dirname, 'src/webview')
      },
      // Prefer ES modules when available
      mainFields: ['module', 'main'],
      // Ensure proper module resolution
      conditionNames: ['node', 'require', 'default']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.json',
                transpileOnly: false,
                compilerOptions: {
                  sourceMap: !isProduction,
                  // Ensure proper module compilation for Node.js
                  module: 'commonjs',
                  target: 'ES2020'
                }
              }
            }
          ]
        }
      ]
    },
    devtool: isProduction ? 'hidden-source-map' : 'source-map',
    optimization: {
      minimize: isProduction,
      usedExports: true,
      sideEffects: false,
      // Tree shaking configuration
      providedExports: true,
      // Ensure proper module concatenation
      concatenateModules: isProduction
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 1000000,
      maxEntrypointSize: 1000000
    },
    infrastructureLogging: {
      level: isProduction ? 'warn' : 'log'
    },
    stats: {
      errorDetails: true,
      colors: true,
      // Reduce noise in development
      modules: isProduction,
      chunks: isProduction,
      chunkModules: isProduction
    },
    // Node.js polyfills (not needed for VS Code extensions but good to be explicit)
    node: false,
    // Ensure proper context for VS Code extension
    context: __dirname
  };
};
