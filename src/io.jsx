import React, {useState, useEffect} from 'react';
import { Box, Text } from 'ink';
import { renderOnce, isStaticOutput} from './output';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import inquirer from 'inquirer';

export function say(...args) {
  if (isStaticOutput) {
    console.log(...args);
    return;
  };

  const colors = ['yellow', 'magenta', 'cyan', 'blue', 'blueBright', 'magentaBright', 'cyanBright', 'whiteBright'];

  renderOnce(
    <Box gap={1} height={20} overflow='hidden' >
      <Text color='white'>!</Text>
      {args.map((arg, i) => <Text color={colors[i]} key={i}>{arg}</Text>)}
    </Box>
  );
}

export async function ask(question, opts = {}) {

  const answers = await inquirer.prompt({ name: question, message: question, ...opts })

  return Object.values(answers)[0];
}

export function yell(text) {
  if (isStaticOutput) {
    console.log();
    console.log(text.toUpperCase());
    console.log();
    return;
  };

  renderOnce(
    <Box gap={1} marginLeft={1}>
      <Gradient name="teen">
        <BigText text={text}/>
      </Gradient>

    </Box>
  );
}