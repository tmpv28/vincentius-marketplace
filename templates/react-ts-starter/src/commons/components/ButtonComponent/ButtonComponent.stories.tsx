import type { Meta, StoryObj } from "@storybook/react-vite";

import ButtonComponent from "./ButtonComponent";

import {
  BUTTON_COMPONENT_SIZES as buttonSizes,
  BUTTON_COMPONENT_STYLE_TYPES as buttonStyleTypes
} from "./modules/constants";

const meta: Meta<typeof ButtonComponent> = {
  title: "Commons/ButtonComponent",
  component: ButtonComponent,
  argTypes: {
    size: { control: "inline-radio", options: Object.values(buttonSizes) },
    styleType: { control: "inline-radio", options: Object.values(buttonStyleTypes) }
  }
};

export default meta;

type ButtonComponentStory = StoryObj<typeof ButtonComponent>;

export const Normal: ButtonComponentStory = {
  args: { children: "Add note" }
};

export const Accent: ButtonComponentStory = {
  args: { children: "Save note", styleType: buttonStyleTypes.accent }
};

export const WithBadge: ButtonComponentStory = {
  args: { children: "Notes", badge: 3, styleType: buttonStyleTypes.transparentWithBorder }
};

// Disabled always pairs with a tooltip: a blocked control that does not say why is a defect.
export const DisabledWithReason: ButtonComponentStory = {
  args: {
    children: "Save note",
    styleType: buttonStyleTypes.accent,
    disabled: true,
    tooltipTitle: "Note title is mandatory."
  }
};

export const Loading: ButtonComponentStory = {
  args: { children: "Saving", styleType: buttonStyleTypes.accent, isLoading: true }
};
