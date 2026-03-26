export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatTokenAmount(amount: string, decimals = 6): string {
  const num = parseInt(amount, 10) / Math.pow(10, decimals);
  return formatNumber(num);
}

export function shortenAddress(addr: string, chars = 8): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const abs = Math.abs(diff);
  const future = diff < 0;

  const seconds = Math.floor(abs / 1000);
  if (seconds < 60) return future ? `in ${seconds}s` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return future ? `in ${days}d` : `${days}d ago`;
}

export function denomToTicker(denom: string): string {
  if (denom.startsWith("u")) return denom.slice(1).toUpperCase();
  if (denom.startsWith("ibc/")) return `IBC/${denom.slice(4, 10)}`;
  if (denom.startsWith("move/")) return `MOVE/${denom.slice(5, 11)}`;
  return denom.toUpperCase();
}
