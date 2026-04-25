export const UI = {
  logo: (): string => {
    return "document-agent";
  },

  error: (message: string): void => {
    process.stderr.write(message + "\n");
  },

  info: (message: string): void => {
    process.stdout.write(message + "\n");
  },
};
