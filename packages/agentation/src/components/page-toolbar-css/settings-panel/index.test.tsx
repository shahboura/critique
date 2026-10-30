import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ToolbarSettings } from "..";
import { SettingsPanel } from "./index";

const settings: ToolbarSettings = {
  outputDetail: "standard",
  autoClearAfterCopy: false,
  annotationColorId: "blue",
  blockInteractions: true,
  reactEnabled: true,
  markerClickBehavior: "edit",
  webhookUrl: "",
  webhooksEnabled: true,
};

const props = {
  settings,
  onSettingsChange: vi.fn(),
  isDarkMode: false,
  onToggleTheme: vi.fn(),
  isDevMode: false,
  connectionStatus: "connected" as const,
  onExited: vi.fn(),
  isOpen: true,
  toolbarNearBottom: false,
  settingsPage: "main" as const,
  onSettingsPageChange: vi.fn(),
  onHideToolbar: vi.fn(),
};

it("offers Clear on copy/send when the host allows clearing", () => {
  render(<SettingsPanel {...props} />);
  expect(screen.getByRole("checkbox", { name: "Clear on copy/send" })).toBeTruthy();
});

it("hides Clear on copy/send when a shared session disables it", () => {
  render(
    <SettingsPanel
      {...props}
      endpoint="http://comments.test"
      autoClearSharedAnnotations={false}
    />,
  );
  expect(screen.queryByRole("checkbox", { name: "Clear on copy/send" })).toBeNull();
  expect(screen.getByRole("checkbox", { name: "Block page interactions" })).toBeTruthy();
});
