module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          alias: {
            "@": "./",                     // project root
            "@core": "./core",             // whole core folder
            "@screens": "./core/screens",  // centralised screens
            "@firebaseLocal": "./core/firebase",
            "@assets": "./assets",
            "@components-ui": "./core/components/ui",
            "@components": "./core/map/components",
            "@config": "./config",
            "@context": "./core/context",
            "@lib": "./core/lib",
            "@themes": "./themes"

          },
          extensions: [".js", ".jsx", ".ts", ".tsx"]
        }
      ]
    ]
  };
};
