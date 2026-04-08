#!/usr/bin/env node
/**
 * Copyright IBM Corp. 2021, 2025
 * SPDX-License-Identifier: MPL-2.0
 */
import {
  intro,
  outro,
  confirm,
  select,
  text,
  group,
  cancel,
  isCancel,
} from '@clack/prompts'
import color from 'picocolors'
import path from 'node:path'
import fs from 'node:fs'

const WORKFLOW_TEMPLATE_FILE = 'template.yml'
const WORKFLOW_FILE = 'nextjs_bundle_analysis.yml'

const DEFAULT_PACKAGE_CONFIG = {
  budget: 350 * 1024,
  budgetPercentIncreaseRed: 20,
  minimumChangeThreshold: 0,
  minimumTotalChangeThreshold: 1024,
  buildOutputDirectory: '.next',
  showDetails: true,
  outputMode: 'comment',
}

const DEFAULT_WORKFLOW_CONFIG = {
  baseBranch: 'main',
  nodeVersion: 18,
  packageManager: 'npm',
  workingDirectory: './',
  buildCommand: './node_modules/.bin/next build',
  buildOutputDirectory: DEFAULT_PACKAGE_CONFIG.buildOutputDirectory,
  outputMode: '',
  minimumChangeThreshold: '',
  minimumTotalChangeThreshold: '',
}

/**
 * @param {Parameters<typeof text>[0]} opts
 * @returns {Promise<number>}
 */
async function number(opts) {
  const result = await text(opts)
  if (isCancel(result)) {
    cancel('Configuration cancelled')
    process.exit(0)
  }
  const parsed = Number.parseInt(String(result), 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a number for "${opts.message}"`)
  }
  return parsed
}

/**
 * @param {Record<string, unknown>} values
 * @returns {boolean}
 */
function hasCancelledValue(values) {
  return Object.values(values).some((value) => isCancel(value))
}

/**
 * @param {Record<string, unknown>} config
 * @returns {Promise<void>}
 */
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

/**
 * @param {Record<string, string | number>} config
 * @returns {Promise<void>}
 */
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
  fs.mkdirSync(workflowsPath, { recursive: true })

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
      .replace(/#\s+output-mode:.+$/m, `  output-mode: ${config.outputMode}`)
      .replace(
        /#\s+minimum-change-threshold:.+$/m,
        `  minimum-change-threshold: ${config.minimumChangeThreshold}`
      )
      .replace(
        /#\s+minimum-total-change-threshold:.+$/m,
        `  minimum-total-change-threshold: ${config.minimumTotalChangeThreshold}`
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
            message: `What would you like the maximum javascript on first load to be (in kb)? (default: ${DEFAULT_PACKAGE_CONFIG.budget / 1024})`,
            defaultValue: DEFAULT_PACKAGE_CONFIG.budget / 1024,
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
    minimumTotalChangeThreshold: () =>
      number({
        message: `If the global bundle's size change is below this threshold (in bytes), check-mode comments will not be posted for it (default: ${DEFAULT_PACKAGE_CONFIG.minimumTotalChangeThreshold})`,
        defaultValue: DEFAULT_PACKAGE_CONFIG.minimumTotalChangeThreshold,
      }),
    buildOutputDirectory: () =>
      text({
        message: `Do you have a custom dist directory? (default: ${DEFAULT_PACKAGE_CONFIG.buildOutputDirectory})`,
        defaultValue: DEFAULT_PACKAGE_CONFIG.buildOutputDirectory,
      }),
    outputMode: () =>
      select({
        message: 'How should bundle analysis be published by default?',
        options: [
          { value: 'comment', label: 'comment', hint: 'default' },
          { value: 'check', label: 'check' },
          { value: 'both', label: 'both' },
        ],
        defaultValue: DEFAULT_PACKAGE_CONFIG.outputMode,
      }),
  })

  if (isCancel(packageConfig) || hasCancelledValue(packageConfig)) {
    cancel('Configuration cancelled')
    return
  }

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
        defaultValue: DEFAULT_WORKFLOW_CONFIG.packageManager,
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
    outputMode: () =>
      text({
        message:
          "Override the repo output mode in this workflow? Leave blank to use package.json.",
        defaultValue: DEFAULT_WORKFLOW_CONFIG.outputMode,
      }),
    minimumChangeThreshold: () =>
      text({
        message:
          'Override the page change threshold in this workflow? Leave blank to use package.json.',
        defaultValue: DEFAULT_WORKFLOW_CONFIG.minimumChangeThreshold,
      }),
    minimumTotalChangeThreshold: () =>
      text({
        message:
          'Override the global change threshold in this workflow? Leave blank to use package.json.',
        defaultValue: DEFAULT_WORKFLOW_CONFIG.minimumTotalChangeThreshold,
      }),
  })

  if (isCancel(workflowConfig) || hasCancelledValue(workflowConfig)) {
    cancel('Configuration cancelled')
    return
  }

  await writeWorkflowFile({
    ...workflowConfig,
    buildOutputDirectory: packageConfig.buildOutputDirectory,
  })

  outro(
    '✅ Workflow file written to .github/workflows/nextjs_bundle_analysis.yml'
  )
}

main()
