import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

interface BrowseResult {
  current: string;
  parent: string | null;
  directories: string[];
}

router.get('/browse', (req: Request, res: Response) => {
  const requestedPath = req.query.path as string | undefined;

  // Windows: no path → list drive letters
  if (!requestedPath && process.platform === 'win32') {
    const drives: string[] = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drive = `${letter}:\\`;
      try {
        fs.accessSync(drive, fs.constants.R_OK);
        drives.push(drive);
      } catch {
        // drive not accessible
      }
    }
    return res.json({
      current: '',
      parent: null,
      directories: drives,
    } as BrowseResult);
  }

  // Unix: no path → use root
  const browsePath = requestedPath || '/';
  const resolved = path.resolve(browsePath);

  try {
    fs.accessSync(resolved, fs.constants.R_OK);
  } catch {
    return res.status(403).json({ error: 'Permission denied' });
  }

  let entries: string[];
  try {
    const dirents = fs.readdirSync(resolved, { withFileTypes: true });
    entries = dirents
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  } catch (err: any) {
    return res.status(403).json({ error: err.message || 'Cannot read directory' });
  }

  const parent = path.dirname(resolved);
  res.json({
    current: resolved,
    parent: parent !== resolved ? parent : null,
    directories: entries,
  } as BrowseResult);
});

export default router;
