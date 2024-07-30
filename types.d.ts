interface FileLine {
  (strings: TemplateStringsArray | string, ...values: any[]): void;
  fromFile(file: string): void;
  currentFile(): void;
}

type TaskStatus = {
  RUNNING: string;
  FAIL: string;
  SUCCESS: string;
};

declare function exec(cmd: TemplateStringsArray, ...values: any[]): {
  env: (newEnvs: Record<string, string>) => Promise<void>;
  cwd: (newCwd: string) => Promise<void>;
};

declare global {
  namespace NodeJS {
    interface Global {
      bunosh: {
        io: {
          say(...args: any[]): void;
          ask(question: string, opts?: Record<string, any>): Promise<any>;
          yell(text: string): void;
        }
        fetch: typeof import('node-fetch');
        exec: typeof exec;
        $: typeof exec;
        writeToFile(
          fileName: string,
          lineBuilderFn: ((fileLine: FileLine) => void) | string
        ): void;
        copyFile(src: string, dst: string): void;
        stopOnFail(enable?: boolean): void;
        ignoreFail(enable?: boolean): void;
        buildCmd(cmd: string): (args: string) => Promise<any>;       
        task(name: string | Function, fn?: Function): Promise<any>;
      };
    }
  }
}

export {};