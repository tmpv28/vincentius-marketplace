import type { Preview } from "@storybook/react-vite";

import "../src/resources/styles/main.scss";

const preview: Preview = {
  parameters: {
    layout: "centered",
    // Reads the palette rather than restating it. main.scss is imported above, so the custom
    // property is defined and a theme change here follows _colorStatics.scss.
    backgrounds: {
      default: "app",
      values: [{ name: "app", value: "rgb(var(--color-black))" }]
    }
  }
};

export default preview;
