import { CopyButton } from "./CopyButton";

export function CommandBlock({ command, label = "Copy command" }: {
  command: string;
  label?: string;
}) {
  return (
    <CopyButton text={command} className="docs-command" label={label}>
      <code>{command}</code>
    </CopyButton>
  );
}
