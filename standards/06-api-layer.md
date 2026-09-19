# 06 — The API layer

This is the layer I care most about and the one that most reveals how I think. It exists to make
one guarantee: **by the time data reaches a component, it has a type that is true.**

---

## The three layers

```
endpointCalls.ts             (domain hook: useAddNote, useNotesLazyFetch)
  -> CRUD controller         (useCreateController, useReadController, ...)
    -> PerformApiService     (axios, response handling, error routing)
      -> responseDataTypeGuard   (validates the shape the server actually sent)
```

Each layer has exactly one job:

| Layer | Job | Knows about |
| --- | --- | --- |
| `endpointCalls` | This endpoint: its URL, its payload, its validation, its success message | The domain |
| Controller | This *kind* of operation: loading state, double-submit lock, default handlers | Operations, not domains |
| Service | Talking to the network and turning any outcome into a response object | HTTP |
| Type guard | Whether the payload is the shape we claimed | One payload |

No layer reaches past its neighbour. A component never sees axios; a service never knows what a
note is.

---

## The controller table

Fixed. One controller per operation, one hook-naming pattern per controller.

| Operation | Controller | Hook pattern | HTTP | Default success |
| --- | --- | --- | --- | --- |
| Create | `useCreateController` | `useAdd<Entity>()` | POST | `showToast` |
| Read | `useReadController` | `useRead<Entity>({ id })` | GET | silent |
| Update | `useUpdateController` | `useEdit<Entity>()` | PATCH | `showToast` |
| Delete | `useDeleteController` | `useDelete<Entity>()` | DELETE | `showToast` |
| List | `useLazyFetchController<T>` | `use<Entity>LazyFetch(filters)` | POST | silent |

Default error handler for every one of them:
`{ action: "showToast", showConsoleMessage: true }`.

Reads are silent because a successful read is not news. Mutations toast because a mutation is
something the user did and needs confirmed.

---

## The response object

Everything returns a `ResponseObjectType`. Successes, failures, validation refusals, aborts.

```typescript
export interface BaseResponseObjectType<T = any> {
  status: boolean;
  statusCodeMsg: string;
  httpStatus?: number;
  msg: string;
  data?: T;
  headers?: any;
  handledRejection: boolean;
}

export interface ResponseObjectType<T = any> extends BaseResponseObjectType<T> {
  isResponseObjectType: true;
}

export type SuccessResponseObjectType<T = any> = ResponseObjectType<T> & {
  status: true;
  data: T;
};

export type FailedResponseObjectType<T = any> = ResponseObjectType<T> & { status: false };
```

Narrowing only happens on a **literal** `true`. `createResponseObject({ status: someBoolean })`
resolves to the failed overload no matter what `someBoolean` turns out to be, so pass the literal
or build the object in the branch that knows.

Two things make it work:

1. **The runtime brand.** `isResponseObjectType: true` survives serialisation, unlike
   `instanceof`, so anything anywhere can ask "is this one of mine?" and get a real answer.
2. **The overloaded factory.** `status: true` at the call site narrows the return type so `data`
   stops being optional for every consumer downstream. That single overload pair removes
   thousands of `?.` from the codebase.

`handledRejection` is the field that stops double-reporting: it marks a rejection that already
showed the user something, so an outer `.catch` knows to stay quiet.

This object is not only for HTTP. Validation functions return it. Permission checks return it.
Anything that can refuse returns it. One vocabulary for "did this work and why not".

---

## The type guard

The guard is where `any` stops. It receives the **raw** `response.data`, which means its depth
has to match the shape the backend actually sends, and the `.then()` that consumes it has to
match the guard.

```typescript
// Server returns the entity directly: .then() reads res.data
responseDataTypeGuard: (responseData): responseData is NoteType =>
  isObject(responseData) && isString(responseData.id) && isString(responseData.title);

// Server wraps it: .then() reads res.data.data
responseDataTypeGuard: (
  responseData
): responseData is ResponseDataContaining<{ data: NoteType }> => isObject(responseData?.data);

// Array payload, shape unknown per entry
responseDataTypeGuard: (responseData): responseData is ResponseDataContaining<{ data: any[] }> =>
  isArray(responseData?.data);
```

**The claim in the predicate has to match what the check actually proves.** A guard written
`(responseData): responseData is NoteType => !isUndefined(responseData)` is a lie with a type
annotation on it: it tells the compiler the payload is a `NoteType` while checking only that the
server sent something at all, and every layer above then treats `any` as a trusted entity. That
is worse than no guard, because no guard leaves `T` as `any` and the `any` is visible.

Two honest options when you cannot afford a field-by-field check:

- Check the fields the code downstream actually reads. Usually that is two or three of them.
- Widen the claim to what you really verified: `responseData is Record<string, any>`, or
  `ResponseDataContaining<{ data: any[] }>` for an array whose entries you have not inspected.

`T` is inferred from the guard's predicate and then flows, unchanged, all the way back up: the
service's call signature is generic in `T`, the controller's is too, and the `.then()` callback
receives `SuccessResponseObjectType<T>`. No guard means `T` falls back to `any`, which is a
choice, and a visible one.

The function types themselves are **not** generic aliases; the `<T>` lives on the call signature
so each call infers its own. See `03-typescript.md` for why, and for the named
`PerformApiServiceAttrbsType<T>` that layers use when they need to spell the argument shape.

**Guard depth must match `.then()` depth.** This is the single most common bug in this layer and
it is silent, because both sides compile.

---

## The endpoint hook

```typescript
export const useAddNote = () => {
  const { createInstance, isLoading } = useCreateController();
  const { createSuccessfulToast } = useToastActionsContext();

  const API_AddNote = useCallback(
    async (noteDetails: API_AddNoteType) => {
      const entityName = treatEntityNameForApiCall({
        defaultEntityName: "note",
        entityNameOptions: { name: noteDetails.title }
      });

      const cleanedNoteDetails = removeEmptyPayloadProperties(noteDetails);

      return createInstance({
        entityName,
        configs: { url: NOTES_API_URL.create, data: cleanedNoteDetails },
        onSuccessHandler: {
          action: () => createSuccessfulToast(`${entityName} added successfully.`)
        },
        extraValidationsBeforePerformingApiService: () => {
          const validation = validateRequiredPayloadDataForAddNote(cleanedNoteDetails);
          if (!validation.status)
            return createResponseObject({
              msg: getRequiredFieldUndefinedErrorMsg({
                actionType: "add",
                entityName: "note",
                fieldName: validation.statusCodeMsg,
                customReason: validation.msg
              })
            });
          return undefined;
        }
      });
    },
    [createInstance, createSuccessfulToast]
  );

  return useMemo(() => ({ API_AddNote, isLoading }), [API_AddNote, isLoading]);
};
```

Read the shape:

- Named export, `use<Operation><Entity>`.
- Returns a memoised object with the `API_`-prefixed call and `isLoading`.
- The payload is cleaned before it is sent, so the server never has to tell "absent" from "blank".
- Validation runs **before** the request through `extraValidationsBeforePerformingApiService`,
  which returns `undefined` when valid. Not a boolean. A response object or nothing, so the
  failure carries its own message.
- The success message is built at this layer, because this is the only layer that knows what the
  user just did.

---

## Folder shape

```
api/
├── configs/                              # The machinery. Domain-free.
│   ├── controllers/CRUD/
│   ├── services/
│   └── modules/handlers/
└── queries/
    └── notes/
        ├── endpointsDefinition.ts        # All URLs for this entity, in one object
        ├── create/
        │   ├── endpointCalls.ts
        │   ├── endpointTypes.ts
        │   └── validateRequiredPayloadData.ts
        ├── read/
        └── lazyFetch/
```

```typescript
export const NOTES_API_URL = {
  create: "/notes",
  update: "/notes",
  delete: "/notes/multiple-soft-delete",
  search: "/notes/search",
  read: "/notes/{id}"
};
```

Every URL for an entity in one object, with `{id}` placeholders left literal so the interpolation
happens in one known place.

**This is an invariant, not a convention.** Zero URL string literals inside an `endpointCalls`
file, on any entity, ever. A backend renaming a route becomes one edit in one file, and grepping
`endpointsDefinition` enumerates the app's entire surface against the server. The moment one URL
is inline, that stops being true and nobody notices until the next rename.

---

## Validation

Complex validation gets its own file in the operation folder, exporting
`validateRequiredPayloadDataFor<Operation><Entity>`. Simple `edit`/`delete` validation can be
inline.

It returns a response object where `statusCodeMsg` carries the **field name** that failed, so the
message builder upstream can name it without the validator needing to know how messages are
phrased.

---

## Double-submit is handled once

The controller holds a `processingRef` and rejects a second call while the first is in flight,
with a `handledRejection: true` response object. Not a disabled button in every feature. Not a
debounce in every form. Once, in the layer that owns the operation.

```typescript
if (processingRef.current)
  return Promise.reject(
    createResponseObject({
      msg: "Action blocked: create already processing.",
      handledRejection: true
    })
  );
```

That is the pattern for every cross-cutting concern in this layer: solve it at the controller,
never at the call site.
