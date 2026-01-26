/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentComments from "../agentComments.js";
import type * as agentHistory from "../agentHistory.js";
import type * as agentVotes from "../agentVotes.js";
import type * as agents from "../agents.js";
import type * as canvases from "../canvases.js";
import type * as crons from "../crons.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_helpers from "../lib/helpers.js";
import type * as lib_membershipSync from "../lib/membershipSync.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_validators from "../lib/validators.js";
import type * as orgMemberships from "../orgMemberships.js";
import type * as orgSettings from "../orgSettings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentComments: typeof agentComments;
  agentHistory: typeof agentHistory;
  agentVotes: typeof agentVotes;
  agents: typeof agents;
  canvases: typeof canvases;
  crons: typeof crons;
  files: typeof files;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/helpers": typeof lib_helpers;
  "lib/membershipSync": typeof lib_membershipSync;
  "lib/validation": typeof lib_validation;
  "lib/validators": typeof lib_validators;
  orgMemberships: typeof orgMemberships;
  orgSettings: typeof orgSettings;
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
