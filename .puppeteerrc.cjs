const { join } = require('path');

/**
 * Where Puppeteer keeps the Chrome it downloads. The default is a folder in
 * the home directory (on Render, /opt/render/.cache/puppeteer), which is
 * thrown away between the build and the running service - so Chrome installs
 * fine and then "could not be found" at runtime. On Render, keep it inside the
 * project so it is carried along with the rest of the build. Anywhere else
 * (a developer's machine, Docker) the default location is left alone.
 */
module.exports = process.env.RENDER
  ? { cacheDirectory: join(__dirname, '.cache', 'puppeteer') }
  : {};
