export function getAdminWallets(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function isAdminWallet(address?: string): boolean {
  if (!address) return false;
  return getAdminWallets().includes(address);
}
