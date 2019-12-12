const { transform } = require('sucrase')

function getTransforms(filename) {
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) {
    return ['jsx', 'imports']
  }
  if (filename.endsWith('.ts')) {
    return ['typescript', 'imports']
  }
  if (filename.endsWith('.tsx')) {
    return ['typescript', 'jsx', 'imports']
  }
  return null
}

module.exports = {
  process: (src, filename) => {
    console.log(filename)
    const transforms = getTransforms(filename)
    if (transforms !== null) {
      const { code, sourceMap } = transform(src, {
        transforms,
        sourceMapOptions: { compiledFilename: filename },
        filePath: filename,
     //    enableLegacyTypeScriptModuleInterop: true
      })

      const mapBase64 = Buffer.from(JSON.stringify(sourceMap)).toString(
        'base64'
      )
      const suffix = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${mapBase64}`     
      return `${code}\n${suffix}`
    }
    return src
  }
}
