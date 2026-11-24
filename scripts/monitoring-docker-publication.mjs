import { randomUUID } from 'node:crypto';
import { lstat, open, rename, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';

/** Shared only by the privileged Docker metric collectors. Keep their exact
 * destination and trust policy independent from the other publishers. */
export async function publishDockerMetrics(path, text, filename, errors) {
  if (typeof path !== 'string' || !isAbsolute(path) || basename(path) !== filename) {
    throw new Error(errors.path);
  }
  const parent = dirname(path);
  const dir = await lstat(parent);
  if (!dir.isDirectory() || (dir.mode & 0o022) !== 0) {
    throw new Error(errors.directory);
  }
  try {
    const old = await lstat(path);
    if (!old.isFile() || old.isSymbolicLink()) {
      throw new Error(errors.target);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const tmp = join(parent, '.' + filename + '.' + randomUUID() + '.tmp');
  let handle;
  try {
    handle = await open(tmp, 'wx', 0o640);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tmp, path);
  } catch {
    await handle?.close().catch(() => undefined);
    await unlink(tmp).catch(() => undefined);
    throw new Error(errors.publication);
  }
}
