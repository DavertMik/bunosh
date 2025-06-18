#!/usr/bin/env bunosh
// Test Bunoshfile with external imports

import lodash from 'lodash';
import chalk from 'chalk';

export async function testImports() {
  console.log('Testing external imports...');
  console.log(chalk.green('Chalk is working!'));
  console.log('Lodash version:', lodash.VERSION);
  return { success: true };
}