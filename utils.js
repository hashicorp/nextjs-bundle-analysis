/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */

const path = require('path')

/**
 * Reads options from `package.json`
 */
const getOptions = (pathPrefix = process.cwd()) => {
  const pkg = require(path.join(pathPrefix, 'package.json'))
  return { ...pkg.nextBundleAnalysis, name: pkg.name }
}

/**
 * Gets the output build directory, defaults to `.next`
 *
 * @param {object} options the options parsed from package.json.nextBundleAnalysis using `getOptions`
 * @returns {string}
 */
const getBuildOutputDirectory = (options) => {
  return options.buildOutputDirectory || '.next'
}

module.exports = {
  getOptions,
  getBuildOutputDirectory,
}
