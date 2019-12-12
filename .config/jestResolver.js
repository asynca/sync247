const fs = require('fs-extra')
const defaultResolver = require(`jest-resolve/build/defaultResolver`).default
module.exports = (request, options) => {
    // Call the defaultResolver, so we leverage its cache, error handling, etc.
    return defaultResolver(request, {
      ...options,
      // Use packageFilter to process parsed `package.json` before the resolution (see https://www.npmjs.com/package/resolve#resolveid-opts-cb)
      packageFilter: (pkg, pkgDir)  => {
        pkgDir = fs.realpathSync(pkgDir)
        const isLocal = (!/[/\\]node_modules[/\\]/.test(pkgDir)) 
        return {
          ...pkg,
          // Alter the value of `main` before resolving the package
          main: isLocal && pkg["ts:main"] || pkg.main,
        };
      },
    });
  };