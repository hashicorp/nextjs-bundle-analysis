/**
 * Copyright IBM Corp. 2021, 2025
 * SPDX-License-Identifier: MPL-2.0
 */

const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const rimraf = require('rimraf')
const { afterEach, beforeEach, expect } = require('@jest/globals')
const mkdirp = require('mkdirp')
const { getBuildOutputDirectory, getOptions } = require('../utils')

const fixturesPath = path.join(__dirname, '__fixtures__')

// Get all test suites (fixtures)
const fixtures = fs
  .readdirSync(fixturesPath, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)

describe('sort of integration', () => {
  fixtures.forEach((dirName) => {
    describe(`fixture ${dirName}`, () => {
      const cwd = path.join(fixturesPath, dirName)
      const options = getOptions(cwd)
      const buildOutputDirectory = getBuildOutputDirectory(options)

      beforeEach(() => {
        process.chdir(cwd)
        execSync('npm install')
        execSync('npm run build')
      })

      afterEach(() => {
        rimraf.sync(path.join(cwd, buildOutputDirectory))
      })

      test(`bundle analysis action generates report and compares artifacts correctly ${dirName}`, () => {
        // make sure the 'report' command works
        execSync('node ../../../report.js')
        const bundleAnalysis = fs.readFileSync(
          path.join(
            process.cwd(),
            buildOutputDirectory,
            'analyze/__bundle_analysis.json'
          ),
          'utf8'
        )
        expect(bundleAnalysis.length).toBeGreaterThan(1)

        // create a fake artifact download - in the real world this would pull from
        // github as part of the action flow
        mkdirp.sync(
          path.join(process.cwd(), buildOutputDirectory, 'analyze/base/bundle')
        )
        const baseStats = JSON.parse(bundleAnalysis)
        // A change exactly at the reporting threshold is still omitted.
        baseStats.__global.gzip += options.minimumChangeThreshold || 0
        fs.writeFileSync(
          path.join(
            process.cwd(),
            buildOutputDirectory,
            'analyze/base/bundle/__bundle_analysis.json'
          ),
          JSON.stringify(baseStats)
        )

        // make sure the 'compare' command works
        execSync('node ../../../compare.js')
        const comment = fs.readFileSync(
          path.join(
            process.cwd(),
            buildOutputDirectory,
            'analyze/__bundle_analysis_comment.txt'
          ),
          'utf8'
        )
        expect(comment).toContain(
          options.minimumChangeThreshold
            ? `No gzipped JavaScript bundle size changed by more than ${options.minimumChangeThreshold} bytes.`
            : 'No gzipped JavaScript bundle size changes to report.'
        )
      })
    })
  })
})
