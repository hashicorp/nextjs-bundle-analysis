#!/usr/bin/env node
/**
 * Copyright IBM Corp. 2021, 2025
 * SPDX-License-Identifier: MPL-2.0
 */

const path = require('path')
const fs = require('fs')
const gzSize = require('gzip-size')
const { getBuildOutputDirectory, getOptions } = require('./utils')

/**
 * @typedef {{raw: number, gzip: number}} BundleSize
 */

/**
 * @param {string} root
 * @returns {void}
 */
function assertBuildOutputExists(root) {
  try {
    fs.accessSync(root, fs.constants.R_OK)
  } catch (err) {
    console.error(
      `No build output found at "${root}" - you may not have your working directory set correctly, or not have run "next build".`
    )
    process.exit(1)
  }
}

/**
 * @param {string} nextMetaRoot
 * @returns {Record<string, string[]>}
 */
function readBuildPages(nextMetaRoot) {
  return require(path.join(nextMetaRoot, 'build-manifest.json')).pages
}

/**
 * @param {string} nextMetaRoot
 * @param {Record<string, string[]>} pages
 * @returns {Record<string, BundleSize>}
 */
function buildBundleAnalysis(nextMetaRoot, pages) {
  const memoryCache = {}
  const globalBundle = pages['/_app'] || []
  const globalBundleSizes = getScriptSizes(nextMetaRoot, globalBundle, memoryCache)

  const allPageSizes = Object.entries(pages).reduce(
    (acc, [pagePath, scriptPaths]) => {
      const scriptSizes = getScriptSizes(
        nextMetaRoot,
        scriptPaths.filter((scriptPath) => !globalBundle.includes(scriptPath)),
        memoryCache
      )

      acc[pagePath] = scriptSizes
      return acc
    },
    {}
  )

  return {
    ...allPageSizes,
    __global: globalBundleSizes,
  }
}

/**
 * @param {string} nextMetaRoot
 * @param {string[]} scriptPaths
 * @param {Record<string, [number, number]>} memoryCache
 * @returns {BundleSize}
 */
function getScriptSizes(nextMetaRoot, scriptPaths, memoryCache) {
  return scriptPaths.reduce(
    (acc, scriptPath) => {
      const [rawSize, gzipSize] = getScriptSize(nextMetaRoot, scriptPath, memoryCache)
      acc.raw += rawSize
      acc.gzip += gzipSize
      return acc
    },
    { raw: 0, gzip: 0 }
  )
}

/**
 * @param {string} nextMetaRoot
 * @param {string} scriptPath
 * @param {Record<string, [number, number]>} memoryCache
 * @returns {[number, number]}
 */
function getScriptSize(nextMetaRoot, scriptPath, memoryCache) {
  const encoding = 'utf8'
  const fullPath = path.join(nextMetaRoot, scriptPath)

  if (fullPath in memoryCache) {
    return memoryCache[fullPath]
  }

  const textContent = fs.readFileSync(fullPath, encoding)
  const rawSize = Buffer.byteLength(textContent, encoding)
  const gzipSize = gzSize.sync(textContent)
  memoryCache[fullPath] = [rawSize, gzipSize]
  return [rawSize, gzipSize]
}

/**
 * @param {string} outputRoot
 * @param {Record<string, BundleSize>} bundleAnalysis
 * @returns {void}
 */
function writeBundleAnalysis(outputRoot, bundleAnalysis) {
  const rawData = JSON.stringify(bundleAnalysis)
  console.log(rawData)
  fs.mkdirSync(path.join(outputRoot, 'analyze/'), { recursive: true })
  fs.writeFileSync(path.join(outputRoot, 'analyze/__bundle_analysis.json'), rawData)
}

/**
 * @returns {void}
 */
function main() {
  const options = getOptions()
  const nextMetaRoot = path.join(
    process.cwd(),
    getBuildOutputDirectory(options)
  )

  assertBuildOutputExists(nextMetaRoot)
  const pages = readBuildPages(nextMetaRoot)
  const bundleAnalysis = buildBundleAnalysis(nextMetaRoot, pages)
  writeBundleAnalysis(nextMetaRoot, bundleAnalysis)
}

if (require.main === module) {
  main()
}

module.exports = {
  assertBuildOutputExists,
  buildBundleAnalysis,
  getScriptSize,
  getScriptSizes,
  main,
  readBuildPages,
  writeBundleAnalysis,
}
