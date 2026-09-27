import React from "react";
import ReactDOM from "react-dom";
import "@testing-library/jest-dom";
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
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

globalThis.ResizeObserver = class ResizeObserver {
  observe() {
    // do nothing
  }

  unobserve() {
    // do nothing
  }

  disconnect() {
    // do nothing
  }
};
