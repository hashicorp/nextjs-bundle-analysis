#!/usr/bin/env node

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
      default: '20',
    },
  ])
  .then((answers) => {
    answers.budget = answers.budget * 1024
    console.log(answers)
    // write values to pacakge.json
    // mkdir -p the .workflows directory
    // copy the template to it
  })
