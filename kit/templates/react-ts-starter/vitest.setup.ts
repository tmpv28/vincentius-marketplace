import React from "react";
import ReactDOM from "react-dom";
import { vi } from "vitest";

ReactDOM.createPortal = vi.fn((element: React.ReactNode) => {
  return element;
}) as unknown as typeof ReactDOM.createPortal;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    // The pre-2020 listener API, stubbed so a library that still falls back to it does not throw.
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// jsdom has no layout engine, so nothing is ever resized; the methods only have to exist.
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
};
