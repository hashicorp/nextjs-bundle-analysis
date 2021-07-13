const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const rimraf = require('rimraf')
const { afterAll, beforeAll, expect } = require('@jest/globals')
const mkdirp = require('mkdirp')

const fixturesPath = path.join(__dirname, '__fixtures__')

beforeAll(() => {
  process.chdir(fixturesPath)
  execSync('npm install')
  execSync('npm run build')
})

afterAll(() => {
  rimraf.sync(path.join(fixturesPath, '.next'))
})

test('sort of integration', () => {
  // make sure the 'report' command works
  execSync('node ../../report.js')
  const bundleAnalysis = fs.readFileSync(
    path.join(process.cwd(), '.next/analyze/__bundle_analysis.json'),
    'utf8'
  )
  expect(bundleAnalysis.length).toBeGreaterThan(1)

  // create a fake artifact download - in the real world this would pull from
  // github as part of the action flow
  mkdirp.sync(path.join(process.cwd(), '.next/analyze/base/bundle'))
  fs.writeFileSync(
    path.join(
      process.cwd(),
      '.next/analyze/base/bundle/__bundle_analysis.json'
    ),
    bundleAnalysis
  )

  // make sure the 'compare' command works
  execSync('node ../../compare.js')
  const comment = fs.readFileSync(
    path.join(process.cwd(), '.next/analyze/__bundle_analysis_comment.txt'),
    'utf8'
  )
  expect(comment).toMatch(/no changes to the javascript bundle/)
})
