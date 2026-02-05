import type { AppNode, AppEdge } from '@/types/canvas';

export interface ParsedFile {
  name: string;
  path: string;
  content: string;
  title: string;
  links: string[]; // [[wikilinks]] found in the file
  tags: string[];
  emoji?: string;
}

export interface FolderCanvasData {
  nodes: AppNode[];
  edges: AppEdge[];
  files: Map<string, ParsedFile>;
  viewport: { x: number; y: number; zoom: number };
}

// Extract emoji from beginning of filename or title
function extractEmoji(text: string): { emoji?: string; clean: string } {
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u;
  const match = text.match(emojiRegex);
  if (match) {
    return {
      emoji: match[1],
      clean: text.slice(match[0].length).trim(),
    };
  }
  return { clean: text };
}

// Parse markdown content and extract metadata
function parseMarkdownFile(filename: string, content: string): ParsedFile {
  const name = filename.replace(/\.md$/, '');
  const { emoji, clean: cleanName } = extractEmoji(name);

  // Extract title from first H1 or use filename
  const h1Match = content.match(/^#\s+(.+)$/m);
  const title = h1Match ? h1Match[1] : cleanName;
  const { emoji: titleEmoji, clean: cleanTitle } = extractEmoji(title);

  // Extract [[wikilinks]]
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const linkTarget = match[1].trim();
    if (!links.includes(linkTarget)) {
      links.push(linkTarget);
    }
  }

  // Extract tags (#tag)
  const tagRegex = /(?:^|\s)#([a-zA-Zа-яА-Я0-9_-]+)/g;
  const tags: string[] = [];
  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[1];
    if (!tags.includes(tag) && !tag.match(/^[0-9]+$/)) {
      tags.push(tag);
    }
  }

  return {
    name,
    path: filename,
    content,
    title: cleanTitle || cleanName,
    links,
    tags,
    emoji: emoji || titleEmoji,
  };
}

// Detect node type based on content and filename
function detectNodeType(file: ParsedFile): string {
  const lowerContent = file.content.toLowerCase();
  const lowerName = file.name.toLowerCase();
  const lowerTitle = file.title.toLowerCase();

  // Database indicators
  if (
    lowerName.includes('database') ||
    lowerName.includes('база') ||
    lowerContent.includes('postgresql') ||
    lowerContent.includes('таблиц') ||
    lowerContent.includes('schema')
  ) {
    return 'database';
  }

  // Tech/API indicators
  if (
    lowerName.includes('api') ||
    lowerName.includes('tech') ||
    lowerName.includes('stack') ||
    lowerName.includes('backend') ||
    lowerContent.includes('endpoint') ||
    lowerContent.includes('typescript') ||
    lowerContent.includes('node.js')
  ) {
    return 'tech';
  }

  // Security indicators
  if (
    lowerName.includes('security') ||
    lowerName.includes('безопасност') ||
    lowerName.includes('авториз') ||
    lowerName.includes('auth') ||
    lowerName.includes('антифрод') ||
    file.emoji === '🔐' ||
    file.emoji === '🛡️'
  ) {
    return 'tech';
  }

  // Default to business
  return 'business';
}

// Get color based on emoji or content
function getNodeColor(file: ParsedFile): string | undefined {
  const emojiColors: Record<string, string> = {
    '🔐': '#ef4444', // red - security
    '🛡️': '#ef4444', // red - security
    '🕵️': '#ef4444', // red - antifraud
    '💰': '#22c55e', // green - money
    '💸': '#22c55e', // green - money
    '👛': '#22c55e', // green - wallets
    '🎮': '#8b5cf6', // purple - games
    '🎲': '#8b5cf6', // purple - games
    '🎁': '#f59e0b', // amber - bonuses
    '🖼️': '#ec4899', // pink - NFT
    '🛒': '#ec4899', // pink - marketplace
    '📊': '#3b82f6', // blue - stats
    '⚙️': '#6b7280', // gray - admin
    '📱': '#06b6d4', // cyan - mobile
    '💬': '#06b6d4', // cyan - chat
    '🌐': '#6366f1', // indigo - languages
    '🤝': '#f97316', // orange - partnership
    '📚': '#84cc16', // lime - docs
  };

  if (file.emoji && emojiColors[file.emoji]) {
    return emojiColors[file.emoji];
  }

  return undefined;
}

// Auto-layout nodes in a grid with connected nodes closer together
function layoutNodes(
  files: ParsedFile[],
  fileMap: Map<string, ParsedFile>
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Calculate connection counts for each file
  const connectionCounts = new Map<string, number>();
  files.forEach((file) => {
    const count = file.links.filter((link) => fileMap.has(link)).length;
    connectionCounts.set(file.name, count);
  });

  // Sort by connection count (most connected first) then by name
  const sortedFiles = [...files].sort((a, b) => {
    const countDiff =
      (connectionCounts.get(b.name) || 0) - (connectionCounts.get(a.name) || 0);
    if (countDiff !== 0) return countDiff;
    return a.name.localeCompare(b.name);
  });

  // Grid layout with spacing
  const cols = Math.ceil(Math.sqrt(files.length));
  const nodeWidth = 280;
  const nodeHeight = 150;
  const gapX = 100;
  const gapY = 80;

  sortedFiles.forEach((file, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    positions.set(file.name, {
      x: col * (nodeWidth + gapX),
      y: row * (nodeHeight + gapY),
    });
  });

  return positions;
}

// Main function to convert folder files to canvas
export function convertFolderToCanvas(
  files: { name: string; content: string }[]
): FolderCanvasData {
  // Parse all markdown files
  const parsedFiles = files
    .filter((f) => f.name.endsWith('.md'))
    .map((f) => parseMarkdownFile(f.name, f.content));

  // Create file map for quick lookup (by name without extension)
  const fileMap = new Map<string, ParsedFile>();
  parsedFiles.forEach((file) => {
    fileMap.set(file.name, file);
    // Also map without emoji prefix for link matching
    const { clean } = extractEmoji(file.name);
    if (clean !== file.name) {
      fileMap.set(clean, file);
    }
  });

  // Calculate positions
  const positions = layoutNodes(parsedFiles, fileMap);

  // Create nodes
  const nodes: AppNode[] = parsedFiles.map((file) => {
    const pos = positions.get(file.name) || { x: 0, y: 0 };
    const nodeType = detectNodeType(file);
    const color = getNodeColor(file);

    return {
      id: file.name,
      type: nodeType,
      position: pos,
      data: {
        label: file.emoji ? `${file.emoji} ${file.title}` : file.title,
        description: extractDescription(file.content),
        color,
        // Store full content for documentation panel
        fullContent: file.content,
        tags: file.tags,
        links: file.links,
      },
      style: {
        width: 280,
      },
    } as AppNode;
  });

  // Create edges from links
  const edges: AppEdge[] = [];
  const edgeSet = new Set<string>();
  const bidirectionalSet = new Set<string>(); // Track bidirectional connections

  // First pass: identify bidirectional connections
  parsedFiles.forEach((file) => {
    file.links.forEach((link) => {
      const targetFile = fileMap.get(link);
      if (targetFile && targetFile.links.includes(file.name)) {
        bidirectionalSet.add([file.name, targetFile.name].sort().join('|'));
      }
    });
  });

  parsedFiles.forEach((file) => {
    file.links.forEach((link) => {
      // Find target file (match by name or clean name)
      const targetFile = fileMap.get(link);
      if (targetFile && targetFile.name !== file.name) {
        const edgeId = `${file.name}->${targetFile.name}`;
        const reverseId = `${targetFile.name}->${file.name}`;
        const bidirectionalKey = [file.name, targetFile.name].sort().join('|');

        // Avoid duplicate edges
        if (!edgeSet.has(edgeId) && !edgeSet.has(reverseId)) {
          edgeSet.add(edgeId);

          // Detect edge type and label
          const isBidirectional = bidirectionalSet.has(bidirectionalKey);
          const edgeLabel = extractEdgeLabel(file.content, link);

          edges.push({
            id: edgeId,
            source: file.name,
            target: targetFile.name,
            type: 'custom',
            animated: false,
            data: {
              edgeType: isBidirectional ? 'bidirectional' : 'arrow',
              label: edgeLabel,
            },
            style: { stroke: '#94a3b8' },
          });
        }
      }
    });
  });

  return {
    nodes,
    edges,
    files: fileMap,
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

// Extract edge label from the context around the wikilink
function extractEdgeLabel(content: string, linkTarget: string): string | undefined {
  // Look for patterns like "связано с [[Link]]" or "использует [[Link]]"
  const patterns = [
    // Russian patterns
    new RegExp(`(использует|связан[оа]?\\s+с|зависит\\s+от|интегрируется\\s+с|вызывает|отправляет\\s+в)\\s*\\[\\[${escapeRegex(linkTarget)}(?:\\|[^\\]]+)?\\]\\]`, 'i'),
    // English patterns
    new RegExp(`(uses|connects\\s+to|depends\\s+on|integrates\\s+with|calls|sends\\s+to)\\s*\\[\\[${escapeRegex(linkTarget)}(?:\\|[^\\]]+)?\\]\\]`, 'i'),
    // Pattern with label syntax [[Link|label]]
    new RegExp(`\\[\\[${escapeRegex(linkTarget)}\\|([^\\]]+)\\]\\]`),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract first paragraph or description from content
function extractDescription(content: string): string {
  // Remove title
  const withoutTitle = content.replace(/^#\s+.+$/m, '').trim();

  // Find first meaningful paragraph
  const paragraphs = withoutTitle.split(/\n\n+/);
  for (const p of paragraphs) {
    const clean = p.trim();
    // Skip empty, headers, tables, code blocks
    if (
      clean &&
      !clean.startsWith('#') &&
      !clean.startsWith('|') &&
      !clean.startsWith('```') &&
      !clean.startsWith('---')
    ) {
      // Return first 150 chars
      return clean.slice(0, 150) + (clean.length > 150 ? '...' : '');
    }
  }

  return '';
}

// Process FileList from drag & drop
export async function processFileList(
  fileList: FileList
): Promise<{ name: string; content: string }[]> {
  const files: { name: string; content: string }[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (file.name.endsWith('.md')) {
      const content = await file.text();
      files.push({ name: file.name, content });
    }
  }

  return files;
}

// Process directory entry (for webkitdirectory)
export async function processDirectoryEntry(
  entry: FileSystemDirectoryEntry
): Promise<{ name: string; content: string }[]> {
  const files: { name: string; content: string }[] = [];

  const readEntries = (
    dirReader: FileSystemDirectoryReader
  ): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      dirReader.readEntries(resolve, reject);
    });
  };

  const readFile = (fileEntry: FileSystemFileEntry): Promise<File> => {
    return new Promise((resolve, reject) => {
      fileEntry.file(resolve, reject);
    });
  };

  const processEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile && entry.name.endsWith('.md')) {
      const file = await readFile(entry as FileSystemFileEntry);
      const content = await file.text();
      files.push({ name: file.name, content });
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await readEntries(dirReader);
      for (const e of entries) {
        await processEntry(e);
      }
    }
  };

  const dirReader = entry.createReader();
  const entries = await readEntries(dirReader);
  for (const e of entries) {
    await processEntry(e);
  }

  return files;
}
