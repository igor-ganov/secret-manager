const KIB = 1024;
const MIB = KIB * 1024;

/* Binary units, one decimal: what the site, the bot, the utility and the
   link page show next to a file name. */
export const formatFileSize = (bytes: number): string => {
  if (bytes < KIB) {
    return `${String(bytes)} B`;
  }
  return bytes < MIB ? `${(bytes / KIB).toFixed(1)} KiB` : `${(bytes / MIB).toFixed(1)} MiB`;
};
