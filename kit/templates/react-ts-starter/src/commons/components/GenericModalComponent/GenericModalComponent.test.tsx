import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it } from "vitest";

import { RenderedContainerType, renderIntoContainer } from "../../testUtils/renderIntoContainer";

import GenericModalComponent from "./GenericModalComponent";
import { GenericModalComponentType } from "./modules/types";

// Mounted, because the contract is the dialog's accessible name, which only exists once the UI
// library has wired its title into the rendered dialog.
let rendered: RenderedContainerType | null = null;

const renderModal = (overrides: Partial<GenericModalComponentType> = {}) => {
  rendered = renderIntoContainer(
    <MantineProvider>
      <GenericModalComponent isGenericModalOpen {...overrides} />
    </MantineProvider>
  );
};

// The document, not the container: Mantine's own Portal mounts the dialog on document.body.
const getDialogName = () => {
  const labelledById = document.querySelector('[role="dialog"]')?.getAttribute("aria-labelledby");
  return labelledById ? document.getElementById(labelledById)?.textContent : null;
};

afterEach(() => {
  rendered?.unmount();
  rendered = null;
});

describe("GenericModalComponent", () => {
  it("names the dialog with its title (the dialog, not the modal root, carries the name)", () => {
    renderModal({ title: "Add note" });
    expect(getDialogName()).toBe("Add note");
  });

  it("leaves the dialog unnamed rather than pointing at a missing element when there is no title", () => {
    renderModal();
    expect(getDialogName()).toBeNull();
  });
});
