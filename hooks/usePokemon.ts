import { useInfiniteQuery } from "@tanstack/react-query";

interface PokemonListResponse {
  next: string | null;
  results: { name: string; url: string }[];
}

interface PokemonDetailsResponse {
  sprites: {
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
    back_shiny: string | null;
  };
  types: { type: { name: string } }[];
  weight: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PokéAPI request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function usePokemonList() {
  return useInfiniteQuery({
    queryKey: ["pokemons", "list"],
    queryFn: async ({ pageParam = 0 }) => {
      const data = await fetchJson<PokemonListResponse>(
        `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=10`,
      );

      const detailedPokemons = await Promise.all(
        data.results.map(async (p) => {
          const details = await fetchJson<PokemonDetailsResponse>(p.url);
          return {
            name: p.name,
            fimage: details.sprites.front_default,
            bimage: details.sprites.back_default,
            fshiny: details.sprites.front_shiny,
            bshiny: details.sprites.back_shiny,
            types: details.types[0].type.name,
            weight: details.weight,
            shiny: false,
          };
        }),
      );

      return {
        pokemons: detailedPokemons,
        nextOffset: data.next ? pageParam + 10 : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}

export function usePokemonNames() {
  return useInfiniteQuery({
    queryKey: ["pokemons", "names"],
    queryFn: async ({ pageParam = 0 }) => {
      const data = await fetchJson<PokemonListResponse>(
        `https://pokeapi.co/api/v2/pokemon?offset=${pageParam}&limit=100`,
      );

      return {
        names: data.results,
        nextOffset: data.next ? pageParam + 100 : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}
