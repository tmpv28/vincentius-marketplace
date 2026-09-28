import { act, ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";

// Shared harness for the hand-rolled component and hook tests in this repo:
// createRoot -> appendChild -> act(render). Stands in for @testing-library/react's render(),
// which is deliberately not a dependency here.

// Tells React this environment flushes updates through act(), so it does not warn on every render.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface RenderedContainerType {
  container: HTMLDivElement;
  rerender: (element: ReactNode) => void;
  unmount: () => void;
}

export const renderIntoContainer = (element: ReactNode): RenderedContainerType => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root: Root = createRoot(container);
  act(() => root.render(element));

  return {
    container,
    rerender: (nextElement) => act(() => root.render(nextElement)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    }
  };
};
