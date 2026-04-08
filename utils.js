/**
 * Copyright IBM Corp. 2021, 2025
 * SPDX-License-Identifier: MPL-2.0
 */

const path = require('path')

const DEFAULT_OUTPUT_MODE = 'comment'

/**
 * @param {string} envKey
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | undefined}
 */
function readEnvOverride(envKey, env = process.env) {
  const value = env[envKey]
  return value === undefined || value === '' ? undefined : value
}

/**
 * @param {string} envKey
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number | undefined}
 */
function readNumberOverride(envKey, env = process.env) {
  const value = readEnvOverride(envKey, env)
  if (value === undefined) return undefined

  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * @param {string} envKey
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean | undefined}
 */
function readBooleanOverride(envKey, env = process.env) {
  const value = readEnvOverride(envKey, env)
  if (value === undefined) return undefined
  return value === 'true'
}

/**
 * Reads options from `package.json`
 *
 * @param {string} [pathPrefix]
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Record<string, unknown> & {name: string, outputMode: string}}
 */
const getOptions = (pathPrefix = process.cwd(), env = process.env) => {
  const pkg = require(path.join(pathPrefix, 'package.json'))
  const packageOptions = pkg.nextBundleAnalysis || {}

  return {
    ...packageOptions,
    outputMode:
      readEnvOverride('NEXTJS_BUNDLE_ANALYSIS_OUTPUT_MODE', env) ||
      packageOptions.outputMode ||
      DEFAULT_OUTPUT_MODE,
    minimumChangeThreshold:
      readNumberOverride('NEXTJS_BUNDLE_ANALYSIS_MINIMUM_CHANGE_THRESHOLD', env) ??
      packageOptions.minimumChangeThreshold,
    minimumTotalChangeThreshold:
      readNumberOverride(
        'NEXTJS_BUNDLE_ANALYSIS_MINIMUM_TOTAL_CHANGE_THRESHOLD',
        env
      ) ?? packageOptions.minimumTotalChangeThreshold,
    buildOutputDirectory:
      readEnvOverride('NEXTJS_BUNDLE_ANALYSIS_BUILD_OUTPUT_DIRECTORY', env) ||
      packageOptions.buildOutputDirectory,
    skipCommentIfEmpty:
      readBooleanOverride('NEXTJS_BUNDLE_ANALYSIS_SKIP_COMMENT_IF_EMPTY', env) ??
      packageOptions.skipCommentIfEmpty,
    name: pkg.name,
  }
}

/**
 * Gets the output build directory, defaults to `.next`
 *
 * @param {{buildOutputDirectory?: string}} options the options parsed from package.json.nextBundleAnalysis using `getOptions`
 * @returns {string}
 */
const getBuildOutputDirectory = (options) => {
  return options.buildOutputDirectory || '.next'
}

module.exports = {
  DEFAULT_OUTPUT_MODE,
  getOptions,
  getBuildOutputDirectory,
}
