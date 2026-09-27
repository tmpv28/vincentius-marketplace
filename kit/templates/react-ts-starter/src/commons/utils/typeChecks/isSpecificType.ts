export function isString(val: any): val is string {
  return typeof val === "string";
}

export function isNumber(val: any): val is number {
  return typeof val === "number";
}

export function isBoolean(val: any): val is boolean {
  return typeof val === "boolean";
}

export function isDate(val: any): val is Date {
  return val instanceof Date;
}

export function isArray<T = any>(val: any): val is T[] {
  return Array.isArray(val);
}

export function isObject(val: any): val is Record<string, any> {
  return typeof val === "object" && val !== null && !isArray(val) && !isDate(val);
}

// A plain object is one whose own enumerable keys ARE its content. Object.keys() says nothing
// about a Map, a Set, a RegExp, an Error or any class instance, so anything that walks or
// compares by keys has to exclude them or it will call two different ones equal.
export function isPlainObject(val: any): val is Record<string, any> {
  if (!isObject(val)) return false;
  const prototype = Object.getPrototypeOf(val);
  return prototype === Object.prototype || prototype === null;
}

export function isUndefined(val: any): val is undefined {
  return typeof val === "undefined";
}

export function isFunction(val: any): val is (...args: any[]) => any {
  return typeof val === "function";
}
