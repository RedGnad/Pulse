// Low-level fetch with timeout — used by all API modules
export async function apiFetch<T>(url: string, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 30 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetchSafe<T>(url: string, fallback: T, timeoutMs = 5000): Promise<T> {
  try {
    return await apiFetch<T>(url, timeoutMs);
  } catch {
    return fallback;
  }
}

export const L1_REST  = "https://rest.testnet.initia.xyz";
export const L1_RPC   = "https://rpc.testnet.initia.xyz";
export const L1_INDEX = "https://api.testnet.initia.xyz";
