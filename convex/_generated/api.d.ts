/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as board from "../board.js";
import type * as flights from "../flights.js";
import type * as http from "../http.js";
import type * as lib_secret from "../lib/secret.js";
import type * as looseEnds from "../looseEnds.js";
import type * as projects from "../projects.js";
import type * as report from "../report.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  board: typeof board;
  flights: typeof flights;
  http: typeof http;
  "lib/secret": typeof lib_secret;
  looseEnds: typeof looseEnds;
  projects: typeof projects;
  report: typeof report;
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
