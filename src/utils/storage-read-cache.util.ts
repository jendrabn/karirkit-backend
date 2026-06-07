import { StorageService } from "../services/storage.service";

type CachedStorageFile = {
  buffer: Buffer;
  contentType: string | null;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 64;
const MAX_CACHEABLE_BYTES = 5 * 1024 * 1024;

const cache = new Map<string, CachedStorageFile>();
const pendingReads = new Map<string, Promise<CachedStorageFile>>();

const cloneEntry = (entry: CachedStorageFile) => ({
  buffer: Buffer.from(entry.buffer),
  contentType: entry.contentType,
});

const pruneCache = () => {
  while (cache.size > MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    cache.delete(oldestKey);
  }
};

export const readCachedStorageFile = async (
  publicPath: string,
  ttlMs = DEFAULT_TTL_MS
): Promise<{ buffer: Buffer; contentType: string | null }> => {
  const key = publicPath.trim();
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cloneEntry(cached);
  }

  if (cached) {
    cache.delete(key);
  }

  const pending = pendingReads.get(key);
  if (pending) {
    return cloneEntry(await pending);
  }

  const readPromise = StorageService.read(key).then((stored) => {
    const entry: CachedStorageFile = {
      buffer: Buffer.from(stored.buffer),
      contentType: stored.contentType,
      expiresAt: Date.now() + ttlMs,
    };

    if (entry.buffer.byteLength <= MAX_CACHEABLE_BYTES) {
      cache.set(key, entry);
      pruneCache();
    }

    return entry;
  });

  pendingReads.set(key, readPromise);

  try {
    return cloneEntry(await readPromise);
  } finally {
    pendingReads.delete(key);
  }
};
