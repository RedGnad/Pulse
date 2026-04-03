"use client";

import { useUsernameQuery } from "@initia/interwovenkit-react";

/**
 * Resolves an Initia address to its .init username.
 * Uses InterwovenKit's on-chain usernames module view function.
 */
export function useUsername(address?: string) {
  const { data: username, isLoading } = useUsernameQuery(address);
  return { username: username ?? null, isLoading };
}
