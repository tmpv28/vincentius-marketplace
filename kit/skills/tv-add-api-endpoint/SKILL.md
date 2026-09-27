---
name: tv-add-api-endpoint
description: Use when adding an API endpoint (create, read, update, delete or lazy-fetch) to a React + TypeScript project that follows TV-STANDARD's three-layer API. Mirrors the project's reference endpoint.
argument-hint: <entity> <operation>
---

# Add an API endpoint

One endpoint in `src/api/queries/<entity>/<operation>/`, through the controller that owns its kind of
operation.

## 1. Read the reference

Read, with the Read tool:

- `src/api/queries/<ref>/endpointsDefinition.ts` and `entityTypes.ts`
- the reference operation of the same kind: `create/` for mutations, `read/` for reads, each file in it
- the controller it will use in `src/api/configs/controllers/CRUD/` and `src/commons/systems/responseObjectSystem/`

The reference is the one the project's `CLAUDE.md` names, else the template at
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/templates/react-ts-starter`.

## 2. Write it

- The URL goes into `endpointsDefinition.ts`, never into `endpointCalls.ts`: zero URL literals there, ever.
- `endpointTypes.ts` holds the `API_`-prefixed wire types; `endpointCalls.ts` exports `use<Operation><Entity>`
  returning a memoised `{ API_<Operation><Entity>, isLoading }`.
- Mutations: payload cleaned before sending; validation in `validateRequiredPayloadData.ts` returning a response
  object whose `statusCodeMsg` names the failing field.
- The `responseDataTypeGuard` checks what the downstream code reads, at the depth the `.then()` reads it. A guard
  that claims more than it checks is worse than none.

## 3. Finish

A colocated test for the guard and the validator. `pnpm std:check` clean. Report the controller used
and why.
