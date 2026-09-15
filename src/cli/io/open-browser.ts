const COMMANDS: Readonly<Record<string, (url: string) => readonly string[]>> = {
  win32: (url) => ['cmd', '/c', 'start', '', url],
  darwin: (url) => ['open', url],
};

const fallback = (url: string): readonly string[] => ['xdg-open', url];

/* Best effort: the url is printed as well, so a failure here only costs a
   copy-and-paste. */
export const openBrowser = async (url: string, platform: string = process.platform): Promise<boolean> => {
  try {
    const command = (COMMANDS[platform] ?? fallback)(url);
    const child = Bun.spawn([...command], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' });
    return (await child.exited) === 0;
  } catch {
    return false;
  }
};
