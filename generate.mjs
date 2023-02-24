#!/usr/bin/env node
/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */
import {
  intro,
  outro,
  confirm,
  select,
  spinner,
  isCancel,
  cancel,
  text,
  group,
  note,
} from '@clack/prompts'
import color from 'picocolors'
import path from 'node:path'
import fs from 'node:fs'
import mkdirp from 'mkdirp'

const WORKFLOW_TEMPLATE_FILE = 'template.yml'
const WORKFLOW_FILE = 'next_bundle_analysis.yml'

const DEFAULT_PACKAGE_CONFIG = {
  budget: 350,
  budgetPercentIncreaseRed: 20,
  minimumChangeThreshold: 0,
  buildOutputDirectory: '.next',
  showDetails: true,
}

const DEFAULT_WORKFLOW_CONFIG = {
  baseBranch: 'main',
  nodeVersion: 18,
  packageManager: 'npm',
  workingDirectory: './',
  buildCommand: './node_modules/.bin/next build',
  buildOutputDirectory: DEFAULT_PACKAGE_CONFIG.buildOutputDirectory,
}

async function number(opts) {
  const result = await text(opts)
  return Number.parseInt(result, 10)
}

async function writePackageJsonConfig(config) {
  // write the config values to package.json
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJsonContent = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8')
  )
  packageJsonContent.nextBundleAnalysis = {
    ...DEFAULT_PACKAGE_CONFIG,
    ...config,
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2))
}

async function writeWorkflowFile(config) {
  const packageJsonPath = new URL('package.json', import.meta.url)
  const packageJsonContent = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8')
  )
  const templatePath = new URL(WORKFLOW_TEMPLATE_FILE, import.meta.url)
  const workflowsPath = path.join(process.cwd(), '.github/workflows')
  const workflowFilePath = path.join(workflowsPath, WORKFLOW_FILE)

  let template = fs.readFileSync(templatePath, 'utf-8')

  // Specify the latest version
  template = template.replace('{PACKAGE_VERSION}', packageJsonContent.version)

  // mkdir -p the .workflows directory
  mkdirp.sync(workflowsPath)

  const areInputsChangedFromDefault = !Object.keys(
    DEFAULT_WORKFLOW_CONFIG
  ).every((key) => DEFAULT_WORKFLOW_CONFIG[key] === config[key])

  if (areInputsChangedFromDefault) {
    // update the base branch
    template = template.replace('- main', `- ${config.baseBranch}`)

    // Update the inputs
    template = template
      .replace('# with:', 'with:')
      .replace(/#\s+node-version:.+$/m, `  node-version: ${config.nodeVersion}`)
      .replace(
        /#\s+package-manager:.+$/m,
        `  package-manager: ${config.packageManager}`
      )
      .replace(
        /#\s+working-directory:.+$/m,
        `  working-directory: ${config.workingDirectory}`
      )
      .replace(
        /#\s+build-output-directory:.+$/m,
        `  build-output-directory: ${config.buildOutputDirectory}`
      )
      .replace(
        /#\s+build-command:.+$/m,
        `  build-command: ${config.buildCommand}`
      )
  }

  fs.writeFileSync(workflowFilePath, template)
}

async function main() {
  console.log('\n', color.inverse(color.bold(' nextjs-bundle-analysis ')), '\n')

  intro(color.inverse(' configuration '))

  const packageConfig = await group({
    budget: async () => {
      const setBudget = await confirm({
        message: 'Would you like to set a performance budget?',
      })

      if (setBudget) {
        return (
          (await number({
            message: `What would you like the maximum javascript on first load to be (in kb)? (default: ${DEFAULT_PACKAGE_CONFIG.budget})`,
            defaultValue: DEFAULT_PACKAGE_CONFIG.budget,
          })) * 1024
        )
      }

      return DEFAULT_PACKAGE_CONFIG.budget
    },
    budgetPercentIncreaseRed: () =>
      number({
        message: `If you exceed this percentage of the budget or filesize, it will be highlighted in red (default: ${DEFAULT_PACKAGE_CONFIG.budgetPercentIncreaseRed})`,
        defaultValue: DEFAULT_PACKAGE_CONFIG.budgetPercentIncreaseRed,
      }),
    minimumChangeThreshold: () =>
      number({
        message: `If a page's size change is below this threshold (in bytes), it will be considered unchanged (default: ${DEFAULT_PACKAGE_CONFIG.minimumChangeThreshold})`,
        defaultValue: DEFAULT_PACKAGE_CONFIG.minimumChangeThreshold,
      }),
    buildOutputDirectory: () =>
      text({
        message: `Do you have a custom dist directory? (default: ${DEFAULT_PACKAGE_CONFIG.buildOutputDirectory})`,
        defaultValue: DEFAULT_PACKAGE_CONFIG.buildOutputDirectory,
      }),
  })

  await writePackageJsonConfig(packageConfig)

  outro('✅ Bundle analysis config written to package.json')

  intro(color.inverse(' workflow file '))

  const workflowConfig = await group({
    baseBranch: () =>
      text({
        message: `What's your base branch? (default: ${DEFAULT_WORKFLOW_CONFIG.baseBranch})`,
        defaultValue: DEFAULT_WORKFLOW_CONFIG.baseBranch,
      }),
    nodeVersion: () =>
      text({
        message: `What node version are you using? (default: ${DEFAULT_WORKFLOW_CONFIG.nodeVersion})`,
        defaultValue: DEFAULT_WORKFLOW_CONFIG.nodeVersion,
      }),
    packageManager: () =>
      select({
        message: 'What package manager do you use?',
        options: [
          { value: 'npm', label: 'npm', hint: 'default' },
          { value: 'yarn', label: 'yarn' },
          { value: 'pnpm', label: 'pnpm' },
        ],
        defaultValue: DEFAULT_WORKFLOW_CONFIG.nodeVersion,
      }),
    workingDirectory: () =>
      text({
        message: `What directory does your app live in? (default: ${DEFAULT_WORKFLOW_CONFIG.workingDirectory})`,
        defaultValue: DEFAULT_WORKFLOW_CONFIG.workingDirectory,
      }),
    buildCommand: () =>
      text({
        message: "What's your build command? (default: next build)",
        defaultValue: DEFAULT_WORKFLOW_CONFIG.buildCommand,
      }),
  })

  await writeWorkflowFile({
    ...workflowConfig,
    buildOutputDirectory: packageConfig.buildOutputDirectory,
  })

  outro(
    '✅ Workflow file written to .github/workflows/next-js-bundle-analysis.yml'
  )
}

main()
