import type { StorybookConfig } from "@storybook/react-vite";

const storybookConfig: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: { name: "@storybook/react-vite", options: {} }
};

export default storybookConfig;
