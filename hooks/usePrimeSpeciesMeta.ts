import { useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Warms the species metadata cache the dex grid renders from.
 *
 * The grid needs a name for every tile, including uncaught ones, and PokéAPI only
 * serves those one species at a time. Rather than blocking the dex on ~150
 * requests, this fires a few batches in the background after the screen has
 * already painted what it can — tiles fill in as the cache lands.
 *
 * Priming is per-device and idempotent, so it stops the moment the range is
 * covered and costs nothing on later visits.
 */
export function usePrimeSpeciesMeta(enabled: boolean) {
  const prime = useAction(api.gameActions.primeSpeciesMeta);
  const poolCap = useQuery(api.game.getProfile)?.poolCap ?? 0;

  const running = useRef(false);
  const primedTo = useRef(0);

  useEffect(() => {
    if (!enabled || poolCap === 0 || running.current) return;
    // Already covered at this depth; nothing to do on later visits.
    if (primedTo.current >= poolCap) return;

    let cancelled = false;
    running.current = true;

    async function warm() {
      let target = Math.min(151, poolCap);
      for (let round = 0; round < 8; round++) {
        const result = await prime({ from: 1, to: target });
        if (cancelled) return;
        if (result.complete) {
          primedTo.current = target;
          return;
        }
        // Widen the window a batch at a time rather than hammering the API for
        // the whole pool the first time the dex is opened.
        target = Math.min(poolCap, target + 48);
        if (target > primedTo.current) primedTo.current = target;
        if (result.fetched === 0) return;
      }
    }

    void warm().catch(() => {
      // A failed warm-up is cosmetic: the grid falls back to dex numbers.
    });

    return () => {
      cancelled = true;
      running.current = false;
    };
  }, [enabled, poolCap, prime]);

  return { poolCap, primedTo: primedTo.current };
}
