/**
 * Copyright IBM Corp. 2021, 2025
 * SPDX-License-Identifier: MPL-2.0
 */

const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const os = require('os')
const rimraf = require('rimraf')
const {
  afterEach,
  beforeEach,
  afterAll,
  expect,
} = require('@jest/globals')
const { getBuildOutputDirectory, getOptions } = require('../utils')
const {
  createCompareContext,
  markdownTable,
  renderStatusIndicator,
  runCompare,
} = require('../compare')
const { buildBundleAnalysis } = require('../report')

const fixturesPath = path.join(__dirname, '__fixtures__')
const TEMP_DIRS = []
const LEGACY_OPENSSL_ENV = {
  ...process.env,
  NODE_OPTIONS: '--openssl-legacy-provider',
}

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
        execSync('npm run build', {
          env: LEGACY_OPENSSL_ENV,
        })
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
        fs.mkdirSync(
          path.join(process.cwd(), buildOutputDirectory, 'analyze/base/bundle'),
          { recursive: true }
        )
        fs.writeFileSync(
          path.join(
            process.cwd(),
            buildOutputDirectory,
            'analyze/base/bundle/__bundle_analysis.json'
          ),
          bundleAnalysis
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
        expect(comment).toMatch(/introduced no changes to the javascript bundle/i)

        const output = JSON.parse(
          fs.readFileSync(
            path.join(
              process.cwd(),
              buildOutputDirectory,
              'analyze/__bundle_analysis_output.json'
            ),
            'utf8'
          )
        )
        expect(output.outputMode).toBe('comment')
        expect(output.checkConclusion).toBe('success')
        expect(comment).toMatch(/__NEXTJS_BUNDLE_bundle-analysis-test-fixture/)
      })
    })
  })
})

describe('compare output modes', () => {
  /**
   * @param {{
   *   nextBundleAnalysis?: Record<string, unknown>,
   *   currentBundle: Record<string, unknown>,
   *   baseBundle?: Record<string, unknown>
   * }} config
   * @returns {{
   *   cwd: string,
   *   buildOutputDirectory: string
   * }}
   */
  function setupCompareFixture(config) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-compare-'))
    TEMP_DIRS.push(cwd)

    const buildOutputDirectory =
      config.nextBundleAnalysis &&
      typeof config.nextBundleAnalysis.buildOutputDirectory === 'string'
        ? config.nextBundleAnalysis.buildOutputDirectory
        : '.next'

    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify(
        {
          name: 'compare-test-package',
          version: '1.0.0',
          nextBundleAnalysis: config.nextBundleAnalysis || {},
        },
        null,
        2
      )
    )

    const analyzeDir = path.join(cwd, buildOutputDirectory, 'analyze')
    fs.mkdirSync(analyzeDir, { recursive: true })
    fs.writeFileSync(
      path.join(analyzeDir, '__bundle_analysis.json'),
      JSON.stringify(config.currentBundle, null, 2)
    )

    if (config.baseBundle) {
      fs.mkdirSync(path.join(analyzeDir, 'base/bundle'), { recursive: true })
      fs.writeFileSync(
        path.join(analyzeDir, 'base/bundle/__bundle_analysis.json'),
        JSON.stringify(config.baseBundle, null, 2)
      )
    }

    return { cwd, buildOutputDirectory }
  }

  /**
   * @param {string} cwd
   * @returns {{
   *   comment: string,
   *   output: Record<string, unknown>
   * }}
   */
  function runCompareCli(cwd, buildOutputDirectory = '.next') {
    execSync(`node "${path.join(__dirname, '..', 'compare.js')}"`, { cwd })

    return {
      comment: fs.readFileSync(
        path.join(
          cwd,
          buildOutputDirectory,
          'analyze/__bundle_analysis_comment.txt'
        ),
        'utf8'
      ),
      output: JSON.parse(
        fs.readFileSync(
          path.join(
            cwd,
            buildOutputDirectory,
            'analyze/__bundle_analysis_output.json'
          ),
          'utf8'
        )
      ),
    }
  }

  afterAll(() => {
    TEMP_DIRS.forEach((dir) => rimraf.sync(dir))
  })

  test('check mode only comments when thresholds are exceeded', () => {
    const fixture = setupCompareFixture({
      nextBundleAnalysis: {
        outputMode: 'check',
        minimumChangeThreshold: 100,
        minimumTotalChangeThreshold: 500,
      },
      currentBundle: {
        __global: { raw: 2000, gzip: 1200 },
        '/': { raw: 1000, gzip: 600 },
        '/about': { raw: 1100, gzip: 650 },
      },
      baseBundle: {
        __global: { raw: 1900, gzip: 900 },
        '/': { raw: 980, gzip: 450 },
        '/about': { raw: 1100, gzip: 600 },
      },
    })

    const { comment, output } = runCompareCli(
      fixture.cwd,
      fixture.buildOutputDirectory
    )

    expect(comment).toMatch(/Bundle size regression detected/)
    expect(comment).toMatch(/See the `nextjs-bundle-analysis \/ compare-test-package` check/)
    expect(output.outputMode).toBe('check')
    expect(output.checkConclusion).toBe('success')
  })

  test('check mode suppresses comments when increases stay under thresholds', () => {
    const fixture = setupCompareFixture({
      nextBundleAnalysis: {
        outputMode: 'check',
        minimumChangeThreshold: 200,
        minimumTotalChangeThreshold: 400,
      },
      currentBundle: {
        __global: { raw: 2000, gzip: 1050 },
        '/': { raw: 1000, gzip: 560 },
      },
      baseBundle: {
        __global: { raw: 1900, gzip: 1000 },
        '/': { raw: 980, gzip: 500 },
      },
    })

    const { comment, output } = runCompareCli(
      fixture.cwd,
      fixture.buildOutputDirectory
    )

    expect(comment).toBe('')
    expect(output.commentBody).toBe('')
    expect(output.checkConclusion).toBe('success')
  })

  test('missing base bundle creates a neutral check result', () => {
    const fixture = setupCompareFixture({
      nextBundleAnalysis: {
        outputMode: 'check',
      },
      currentBundle: {
        __global: { raw: 2000, gzip: 1000 },
        '/': { raw: 1000, gzip: 500 },
      },
    })

    const { comment, output } = runCompareCli(
      fixture.cwd,
      fixture.buildOutputDirectory
    )

    expect(comment).toBe('')
    expect(output.missingBase).toBe(true)
    expect(output.checkConclusion).toBe('neutral')
    expect(output.report).toMatch(/No base bundle artifact was found/)
  })

  test('global report visibility uses minimum total change threshold', () => {
    const fixture = setupCompareFixture({
      nextBundleAnalysis: {
        outputMode: 'check',
        minimumChangeThreshold: 500,
        minimumTotalChangeThreshold: 100,
      },
      currentBundle: {
        __global: { raw: 2000, gzip: 1150 },
        '/': { raw: 1000, gzip: 500 },
      },
      baseBundle: {
        __global: { raw: 1900, gzip: 1000 },
        '/': { raw: 1000, gzip: 500 },
      },
    })

    const { output } = runCompareCli(fixture.cwd, fixture.buildOutputDirectory)

    expect(output.report).toMatch(/Global Bundle Size Increased/)
    expect(output.commentBody).toMatch(/Global bundle increased/)
  })

  test('comment mode keeps both legacy and new managed tags', () => {
    const fixture = setupCompareFixture({
      nextBundleAnalysis: {
        outputMode: 'comment',
      },
      currentBundle: {
        __global: { raw: 2000, gzip: 1000 },
        '/': { raw: 1000, gzip: 500 },
      },
      baseBundle: {
        __global: { raw: 2000, gzip: 1000 },
        '/': { raw: 1000, gzip: 500 },
      },
    })

    const { comment } = runCompareCli(fixture.cwd, fixture.buildOutputDirectory)

    expect(comment).toMatch(/__NEXTJS_BUNDLE_compare-test-package/)
    expect(comment).toMatch(/__NEXTJS_BUNDLE_ANALYSIS__/)
  })

  test('both mode posts the full report as a comment', () => {
    const fixture = setupCompareFixture({
      nextBundleAnalysis: {
        outputMode: 'both',
      },
      currentBundle: {
        __global: { raw: 2000, gzip: 1000 },
        '/': { raw: 1000, gzip: 500 },
      },
      baseBundle: {
        __global: { raw: 2000, gzip: 1000 },
        '/': { raw: 1000, gzip: 500 },
      },
    })

    const { comment, output } = runCompareCli(
      fixture.cwd,
      fixture.buildOutputDirectory
    )

    expect(output.outputMode).toBe('both')
    expect(comment).toMatch(/introduced no changes to the javascript bundle/i)
  })
})

describe('compare helpers', () => {
  const context = createCompareContext({
    name: 'helper-test',
    budget: 1000,
    budgetPercentIncreaseRed: 20,
    minimumChangeThreshold: 100,
    minimumTotalChangeThreshold: 200,
    outputMode: 'check',
  })

  test('renderStatusIndicator handles increases, decreases, and invalid numbers', () => {
    expect(renderStatusIndicator(context, 10)).toBe('🟡 +')
    expect(renderStatusIndicator(context, 25)).toBe('🔴 +')
    expect(renderStatusIndicator(context, -5)).toBe('🟢 ')
    expect(renderStatusIndicator(context, Infinity)).toBe('')
  })

  test('markdownTable renders correct budget deltas from base values', () => {
    const markdown = markdownTable(
      context,
      [
        {
          page: '/',
          raw: 0,
          gzip: 500,
          gzipDiff: 100,
          increase: true,
        },
      ],
      { page: 'global', raw: 0, gzip: 200 },
      { page: 'global', raw: 0, gzip: 100 }
    )

    expect(markdown).toMatch(/70.00%/)
    expect(markdown).toMatch(/_\(🔴 \+20\.00%\)_/)
  })

  test('markdownTable does not emit NaN or Infinity for zero-sized page bundles', () => {
    const markdown = markdownTable(context, [
      {
        page: '/empty',
        raw: 0,
        gzip: 0,
        gzipDiff: 0,
        increase: false,
      },
    ])

    expect(markdown).not.toMatch(/NaN|Infinity/)
  })

  test('runCompare returns neutral output when current bundle is missing', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-missing-current-'))
    TEMP_DIRS.push(cwd)
    const outputRoot = path.join(cwd, '.next', 'analyze')
    fs.mkdirSync(outputRoot, { recursive: true })

    const output = runCompare(context, outputRoot)

    expect(output.checkConclusion).toBe('neutral')
    expect(output.report).toMatch(/No current bundle artifact was found/)
  })

  test('runCompare returns neutral output when global bundle metadata is missing', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-missing-global-'))
    TEMP_DIRS.push(cwd)
    const outputRoot = path.join(cwd, '.next', 'analyze')
    fs.mkdirSync(path.join(outputRoot, 'base/bundle'), { recursive: true })
    fs.writeFileSync(
      path.join(outputRoot, '__bundle_analysis.json'),
      JSON.stringify({
        '/': { raw: 100, gzip: 50 },
      })
    )
    fs.writeFileSync(
      path.join(outputRoot, 'base/bundle/__bundle_analysis.json'),
      JSON.stringify({
        '/': { raw: 90, gzip: 45 },
      })
    )

    const output = runCompare(context, outputRoot)

    expect(output.checkConclusion).toBe('neutral')
    expect(output.report).toMatch(/missing the global bundle metadata/)
  })
})

describe('report helpers', () => {
  test('buildBundleAnalysis supports builds without /_app', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-report-'))
    TEMP_DIRS.push(cwd)

    const staticDir = path.join(cwd, 'static/chunks')
    fs.mkdirSync(staticDir, { recursive: true })
    fs.writeFileSync(path.join(staticDir, 'index.js'), 'console.log("index")')

    const analysis = buildBundleAnalysis(cwd, {
      '/': ['static/chunks/index.js'],
    })

    expect(analysis.__global).toEqual({ raw: 0, gzip: 0 })
    expect(analysis['/'].raw).toBeGreaterThan(0)
    expect(analysis['/'].gzip).toBeGreaterThan(0)
  })
})
