const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
  '.toml', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.css', '.scss',
  '.html', '.xml', '.sql', '.sh', '.bash', '.zsh', '.env', '.gitignore',
  '.dockerfile', '.csv',
]);

export function isTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  // Handle dotfiles like .env, .gitignore
  if (lower.startsWith('.') && TEXT_EXTENSIONS.has(lower)) return true;
  const dotIndex = lower.lastIndexOf('.');
  if (dotIndex === -1) return false;
  return TEXT_EXTENSIONS.has(lower.slice(dotIndex));
}

function readEntries(
  dirReader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    dirReader.readEntries(resolve, reject);
  });
}

function readFileEntry(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

export interface ProcessedFile {
  name: string;
  content: string;
}

/**
 * Recursively reads all files from a directory entry, filtered by a predicate.
 * @param entry - The directory entry to process
 * @param filter - Optional predicate to filter files by name. Defaults to accepting all files.
 */
export async function processDirectory(
  entry: FileSystemDirectoryEntry,
  filter: (filename: string) => boolean = () => true
): Promise<ProcessedFile[]> {
  const files: ProcessedFile[] = [];

  const processEntry = async (e: FileSystemEntry): Promise<void> => {
    if (e.isFile && filter(e.name)) {
      const file = await readFileEntry(e as FileSystemFileEntry);
      const content = await file.text();
      files.push({ name: file.name, content });
    } else if (e.isDirectory) {
      const dirReader = (e as FileSystemDirectoryEntry).createReader();
      let entries = await readEntries(dirReader);
      while (entries.length > 0) {
        for (const child of entries) {
          await processEntry(child);
        }
        entries = await readEntries(dirReader);
      }
    }
  };

  const dirReader = entry.createReader();
  let entries = await readEntries(dirReader);
  while (entries.length > 0) {
    for (const e of entries) {
      await processEntry(e);
    }
    entries = await readEntries(dirReader);
  }

  return files;
}

export interface AttachedFile {
  name: string;
  content: string;
  size: number;
}

/**
 * Processes dropped items from a DataTransfer object.
 * Handles both individual files and folders (via webkitGetAsEntry).
 * Folders are recursively traversed; only text files are included.
 */
export async function processDroppedItems(
  dataTransfer: DataTransfer
): Promise<AttachedFile[]> {
  const result: AttachedFile[] = [];
  const items = dataTransfer.items;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'file') continue;

    const entry = item.webkitGetAsEntry?.();

    if (entry?.isDirectory) {
      const dirFiles = await processDirectory(
        entry as FileSystemDirectoryEntry,
        isTextFile
      );
      for (const f of dirFiles) {
        result.push({ name: f.name, content: f.content, size: f.content.length });
      }
    } else {
      // Regular file — read it directly
      const file = item.getAsFile();
      if (file) {
        try {
          const content = await file.text();
          result.push({ name: file.name, content, size: file.size });
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  return result;
}
