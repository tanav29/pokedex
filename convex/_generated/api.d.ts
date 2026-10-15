/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as favorites from "../favorites.js";
import type * as game from "../game.js";
import type * as gameActions from "../gameActions.js";
import type * as http from "../http.js";
import type * as lib_gameLogic from "../lib/gameLogic.js";
import type * as lib_quests from "../lib/quests.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  favorites: typeof favorites;
  game: typeof game;
  gameActions: typeof gameActions;
  http: typeof http;
  "lib/gameLogic": typeof lib_gameLogic;
  "lib/quests": typeof lib_quests;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
