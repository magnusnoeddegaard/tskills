/**
 * Registry configuration with remote fetch and local caching.
 *
 * Instead of hardcoding the Supabase anon key in source, we:
 * 1. Check environment variable overrides
 * 2. Read from local cache (~/.tskills/registry-config.json)
 * 3. Fetch fresh config from a remote URL if cache is expired
 * 4. Fall back to compiled-in defaults if everything else fails
 *
 * This allows key rotation without requiring npm package updates.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.tskills');
const CONFIG_CACHE_FILE = path.join(CONFIG_DIR, 'registry-config.json');

// Remote config URL — serves a JSON file with { supabaseUrl, supabaseAnonKey }
// This can be a Supabase public storage bucket, GitHub raw URL, or any HTTPS endpoint.
const CONFIG_URL =
  process.env.TSKILLS_CONFIG_URL ||
  'https://fdfhydiwtccwcjwczkul.supabase.co/storage/v1/object/public/config/registry.json';

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Compiled-in fallback (used only when fetch fails AND no cache exists)
const FALLBACK_CONFIG: RegistryConfig = {
  supabaseUrl: 'https://fdfhydiwtccwcjwczkul.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZmh5ZGl3dGNjd2Nqd2N6a3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDMzODQsImV4cCI6MjA4NTY3OTM4NH0.W6LzaxvkqnqGdWsr7zhFWxEHfJzqjcqqa3j9cR8fk_E',
};

export interface RegistryConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface CachedConfig extends RegistryConfig {
  fetchedAt: string;
}

async function readCachedConfig(): Promise<CachedConfig | null> {
  try {
    const content = await fs.readFile(CONFIG_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(content) as CachedConfig;
    if (parsed.supabaseUrl && parsed.supabaseAnonKey && parsed.fetchedAt) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCachedConfig(config: RegistryConfig): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    const cached: CachedConfig = {
      ...config,
      fetchedAt: new Date().toISOString(),
    };
    await fs.writeFile(CONFIG_CACHE_FILE, JSON.stringify(cached, null, 2), 'utf-8');
  } catch {
    // Ignore cache write failures — non-critical
  }
}

async function fetchRemoteConfig(): Promise<RegistryConfig | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(CONFIG_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (
      typeof data.supabaseUrl === 'string' &&
      typeof data.supabaseAnonKey === 'string'
    ) {
      return {
        supabaseUrl: data.supabaseUrl,
        supabaseAnonKey: data.supabaseAnonKey,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// In-memory singleton so we only resolve once per process
let resolvedConfig: RegistryConfig | null = null;

/**
 * Get registry configuration (Supabase URL + anon key).
 *
 * Resolution order:
 * 1. Environment variables (TSKILLS_SUPABASE_URL + TSKILLS_SUPABASE_ANON_KEY)
 * 2. Fresh local cache (< 24 hours old)
 * 3. Remote fetch from CONFIG_URL
 * 4. Expired local cache (stale but better than nothing)
 * 5. Compiled-in fallback
 */
export async function getRegistryConfig(): Promise<RegistryConfig> {
  if (resolvedConfig) {
    return resolvedConfig;
  }

  // 1. Environment variable overrides take top priority
  if (process.env.TSKILLS_SUPABASE_URL && process.env.TSKILLS_SUPABASE_ANON_KEY) {
    resolvedConfig = {
      supabaseUrl: process.env.TSKILLS_SUPABASE_URL,
      supabaseAnonKey: process.env.TSKILLS_SUPABASE_ANON_KEY,
    };
    return resolvedConfig;
  }

  // 2. Try local cache
  const cached = await readCachedConfig();
  const cacheAge = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;

  if (cached && cacheAge < CACHE_TTL_MS) {
    resolvedConfig = {
      supabaseUrl: cached.supabaseUrl,
      supabaseAnonKey: cached.supabaseAnonKey,
    };
    return resolvedConfig;
  }

  // 3. Fetch fresh config from remote
  const remote = await fetchRemoteConfig();
  if (remote) {
    await writeCachedConfig(remote);
    resolvedConfig = remote;
    return resolvedConfig;
  }

  // 4. Use expired cache if available
  if (cached) {
    resolvedConfig = {
      supabaseUrl: cached.supabaseUrl,
      supabaseAnonKey: cached.supabaseAnonKey,
    };
    return resolvedConfig;
  }

  // 5. Compiled-in fallback (first run with no internet)
  resolvedConfig = { ...FALLBACK_CONFIG };
  return resolvedConfig;
}
