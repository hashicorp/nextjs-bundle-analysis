#!/usr/bin/env node
/**
 * Copyright (c) HashiCorp, Inc.
 * SPDX-License-Identifier: MPL-2.0
 */


const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp')
const inquirer = require('inquirer')

inquirer
  .prompt([
    {
      type: 'confirm',
      name: 'useBudget',
      message: 'Would you like to set a performance budget?',
      default: true,
    },
    {
      type: 'number',
      name: 'budget',
      message:
        'What would you like the maximum javascript on first load to be (in kb)?',
      default: 350,
      when: (answers) => answers.useBudget,
    },
    {
      type: 'number',
      name: 'redIndicatorPercentage',
      message:
        'If you exceed this percentage of the budget or filesize, it will be highlighted in red',
      default: 20,
    },
    {
      type: 'number',
      name: 'minimumChangeThreshold',
      message: `If a page's size change is below this threshold (in bytes), it will be considered unchanged`,
      default: 0,
    },
  ])
  .then((answers) => {
    // write the config values to package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const packageJsonContent = require(packageJsonPath)
    packageJsonContent.nextBundleAnalysis = {
      budget: answers.budget * 1024,
      budgetPercentIncreaseRed: answers.redIndicatorPercentage,
      minimumChangeThreshold: answers.minimumChangeThreshold,
      showDetails: true, // add a default "showDetails" argument
    }
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJsonContent, null, 2)
    )
    // mkdir -p the .workflows directory
    const workflowsPath = path.join(process.cwd(), '.github/workflows')
    mkdirp.sync(workflowsPath)

    // copy the template to it
    const templatePath = path.join(__dirname, 'template.yml')
    const destinationPath = path.join(
      workflowsPath,
      'nextjs_bundle_analysis.yml'
    )
    fs.copyFileSync(templatePath, destinationPath)
  })
