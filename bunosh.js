#!/usr/bin/env bun
import program, { BUNOSHFILE, banner }  from "./src/program.js";
import { existsSync, readFileSync, statSync } from "fs";
import init from "./src/init.js";
import path from "path";
import color from "chalk";
import './index.js';

// Parse --bunoshfile flag before importing tasks
const bunoshfileIndex = process.argv.indexOf('--bunoshfile');
let customBunoshfile = null;
if (bunoshfileIndex !== -1 && bunoshfileIndex + 1 < process.argv.length) {
  customBunoshfile = process.argv[bunoshfileIndex + 1];
  // Remove the flag and its value from process.argv so it doesn't interfere with command parsing
  process.argv.splice(bunoshfileIndex, 2);
}

let tasksFile;
if (customBunoshfile) {
  const resolvedPath = path.isAbsolute(customBunoshfile) ? customBunoshfile : path.resolve(customBunoshfile);
  // If it's a directory, append the default BUNOSHFILE
  if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
    tasksFile = path.join(resolvedPath, BUNOSHFILE);
    // Change working directory to the bunoshfile directory
    process.chdir(resolvedPath);
  } else {
    tasksFile = resolvedPath;
    // Change working directory to the bunoshfile's directory
    process.chdir(path.dirname(resolvedPath));
  }
} else {
  tasksFile = path.join(process.cwd(), BUNOSHFILE);
}

if (!existsSync(tasksFile)) {
  banner();

  if (process.argv.includes('init')) {
    init();
    process.exit(0);
  }

  console.log();
  console.error(`Bunoshfile not found: ${tasksFile}`);
  console.log(customBunoshfile ? 
    `Run \`bunosh init\` in the directory or specify a valid --bunoshfile path` :
    "Run `bunosh init` to create a new Bunoshfile here")
  console.log();
  process.exit(1);
}

import(tasksFile).then((tasks) => {
  try {
    const source = readFileSync(tasksFile, "utf-8");
    program(tasks, source);
  } catch (error) {
    handleBunoshfileError(error, tasksFile);
  }
}).catch((error) => {
  handleBunoshfileError(error, tasksFile);
});

function handleBunoshfileError(error, filePath) {
  banner();
  console.log();
  
  // Check for Babel parser syntax errors
  if (error.code === 'BABEL_PARSER_SYNTAX_ERROR' || 
      (error.reasonCode && error.loc) || 
      error.constructor.name === 'SyntaxError') {
    
    console.error(`❌ Syntax Error in ${path.basename(filePath)}:`);
    console.log();
    
    if (error.loc) {
      console.error(`   Line ${error.loc.line}, Column ${error.loc.column}:`);
      
      // Provide specific error messages based on reasonCode
      if (error.reasonCode === 'VarRedeclaration') {
        console.error(`   Variable redeclaration - '${error.message}' is already declared`);
      } else if (error.reasonCode && error.reasonCode.includes('Unexpected')) {
        console.error(`   ${error.reasonCode}: ${error.message || 'Unexpected token'}`);
      } else {
        console.error(`   ${error.message || error.reasonCode || 'Invalid syntax'}`);
      }
    } else {
      console.error(`   ${error.message || 'Invalid JavaScript syntax'}`);
    }
    
    console.log();
    console.log('💡 Common issues:');
    console.log('   • Missing semicolons or commas');
    console.log('   • Unclosed brackets, parentheses, or quotes'); 
    console.log('   • Invalid variable declarations');
    console.log('   • Mixing import/export with require/module.exports');
    console.log();
    console.log(`📝 Edit your Bunoshfile: ${color.blue('bunosh edit')}`);
    console.log(`🔧 Validate syntax: ${color.blue(`bun --check ${path.basename(filePath)}`)}`);
    
  } else if (error.message && error.message.includes('SyntaxError')) {
    console.error(`❌ JavaScript Syntax Error in ${path.basename(filePath)}:`);
    console.log();
    console.error(`   ${error.message}`);
    console.log();
    console.log(`💡 Try running: ${color.blue('bun --check Bunoshfile.js')}`);
    console.log(`📝 Edit your Bunoshfile: ${color.blue('bunosh edit')}`);
    
  } else if (error.code === 'MODULE_NOT_FOUND' || 
             error.message?.includes('Cannot resolve') ||
             error.message?.includes('Could not resolve')) {
    console.error(`❌ Module Import Error in ${path.basename(filePath)}:`);
    console.log();
    console.error(`   ${error.message}`);
    console.log();
    console.log('💡 Common solutions:');
    console.log(`   • Run: ${color.blue('bun install')}`);
    console.log('   • Check import paths are correct');
    console.log('   • Ensure dependencies are listed in package.json');
    
  } else {
    console.error(`❌ Error loading ${path.basename(filePath)}:`);
    console.log();
    console.error(`   ${error.message || error.toString()}`);
    
    // Add stack trace for debugging if available
    if (process.env.BUNOSH_DEBUG) {
      console.log();
      console.log('🐛 Debug stack trace:');
      console.log(error.stack || 'No stack trace available');
    }
    
    console.log();
    console.log('💡 Try:');
    console.log(`   • Check the file exists: ${color.blue(`ls -la ${path.basename(filePath)}`)}`);
    console.log(`   • Validate syntax: ${color.blue(`bun --check ${path.basename(filePath)}`)}`);
    console.log(`   • Edit the file: ${color.blue('bunosh edit')}`);
    console.log(`   • Run with debug: ${color.blue('BUNOSH_DEBUG=1 bunosh')}`);
  }
  
  console.log();
  process.exit(1);
}
