import React, {useState, useEffect} from 'react';
import { Box, Text } from 'ink';
import { renderOnce, isStaticOutput} from './src/output';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

export function say(...args) {
  if (isStaticOutput) {
    console.log(...args);
    return;
  };

  const colors = ['yellow', 'magenta', 'cyan', 'blue', 'blueBright', 'magentaBright', 'cyanBright', 'whiteBright'];

  renderOnce(
    <Box gap={1} marginLeft={1}>
      <Text>📢</Text>
      {args.map((arg, i) => <Text color={colors[i]} key={i}>{arg}</Text>)}
    </Box>
  );
}

export async function ask(question, opts = { placeholder: '' }) {
  let userResponse = null;

  render(<></>)

  const AskQuery = () => {
    const [query, setQuery] = useState('');
  
    function finish() {
      userResponse = query;
      unmount();
    }

    return (
      <Box>
        <Box marginRight={1}>
          <Text>{question}</Text>
        </Box>
  
        <TextInput value={query} onSubmit={finish} onChange={setQuery} />
      </Box>
    );
  };
  
  await render(<AskQuery />); 

  return userResponse;
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