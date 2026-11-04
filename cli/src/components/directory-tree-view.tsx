// DirectoryTreeView - Renders a directory tree with file status colors and change counts.
// Shows added files in green, modified in default text, deleted in red, renamed in yellow.
// Change counts (+n,-n) use green/red for the numbers, brackets are muted.
// Supports click-to-scroll via onFileSelect callback.

import * as React from "react"
import { buildDirectoryTree, type TreeFileInfo, type TreeNode } from "../directory-tree.js"
import { getResolvedTheme, rgbaToHex } from "../themes.js"

export interface DirectoryTreeViewProps {
  /** Files to display in the tree */
  files: TreeFileInfo[]
  /** Callback when a file is clicked (receives fileIndex) */
  onFileSelect?: (fileIndex: number) => void
  /** Theme name for colors */
  themeName: string
  /** Available columns; names longer than this are truncated with an ellipsis */
  maxWidth?: number
}

/**
 * Get the color for a file based on its status
 * Uses diff colors from theme: green (added), red (deleted), yellow (renamed), default text (modified)
 */
function getStatusColor(status: "added" | "modified" | "deleted" | "renamed", theme: ReturnType<typeof getResolvedTheme>): string {
  switch (status) {
    case "added":
      return rgbaToHex(theme.diffAdded) // green
    case "deleted":
      return rgbaToHex(theme.diffRemoved) // red
    case "renamed":
      return rgbaToHex(theme.warning) // yellow - renamed/moved file
    case "modified":
      return rgbaToHex(theme.text) // default text color, same as folders
  }
}

interface TreeNodeLineProps {
  node: TreeNode
  theme: ReturnType<typeof getResolvedTheme>
  mutedColor: string
  textColor: string
  maxWidth?: number
  onSelect?: () => void
}

/** Keep a label inside the available columns; the file header shows the full path */
export function truncateToWidth(text: string, available: number): string {
  if (text.length <= available) return text
  if (available <= 0) return ""
  if (available === 1) return "\u2026"
  return `${text.slice(0, available - 1)}\u2026`
}

/**
 * Render a single tree node line with proper colors
 */
const TreeNodeLine: React.FC<TreeNodeLineProps> = ({
  node,
  theme,
  mutedColor,
  textColor,
  maxWidth,
  onSelect,
}) => {
  const [isHovered, setIsHovered] = React.useState(false)

  if (node.isFile) {
    // File node - colorize based on status
    const pathColor = node.status ? getStatusColor(node.status, theme) : textColor
    const addColor = rgbaToHex(theme.diffAdded) // green
    const delColor = rgbaToHex(theme.diffRemoved) // red
    const hasAdditions = (node.additions ?? 0) > 0
    const hasDeletions = (node.deletions ?? 0) > 0

    const callDiffPrefix = node.prefix + (node.connector.startsWith("├") ? "│   " : "    ")
    const countText = [
      hasAdditions ? `+${node.additions}` : "",
      hasAdditions && hasDeletions ? "," : "",
      hasDeletions ? `-${node.deletions}` : "",
    ].join("")
    const countsWidth = 2 + countText.length + 1
    const available = maxWidth === undefined
      ? Number.POSITIVE_INFINITY
      : maxWidth - node.prefix.length - node.connector.length - countsWidth
    const displayPath = truncateToWidth(node.displayPath, available)

    return (
      <box style={{ flexDirection: "column" }}>
        <box
          style={{
            flexDirection: "row",
            backgroundColor: isHovered ? rgbaToHex(theme.backgroundPanel) : undefined,
          }}
          onMouseMove={() => setIsHovered(true)}
          onMouseOut={() => setIsHovered(false)}
          // onMouseDown={onSelect} // disabled: conflicts with copy selection
        >
          <text fg={mutedColor}>{node.prefix}{node.connector}</text>
          <text fg={pathColor}>{displayPath}</text>
          <text fg={mutedColor}> (</text>
          {hasAdditions && <text fg={addColor}>+{node.additions}</text>}
          {hasAdditions && hasDeletions && <text fg={mutedColor}>,</text>}
          {hasDeletions && <text fg={delColor}>-{node.deletions}</text>}
          <text fg={mutedColor}>)</text>
        </box>
        {node.callDiffs?.flatMap((tree, treeIndex) =>
          tree.ascii.split("\n").map((line, lineIndex) => {
            const color = line.startsWith("+")
              ? addColor
              : line.startsWith("-")
                ? delColor
                : textColor
            return (
              <box key={`${treeIndex}-${lineIndex}`} style={{ flexDirection: "row" }}>
                <text fg={mutedColor}>{callDiffPrefix}</text>
                <text fg={color}>{line}</text>
              </box>
            )
          }),
        )}
      </box>
    )
  }

  // Directory node - use muted color for everything
  const available = maxWidth === undefined
    ? Number.POSITIVE_INFINITY
    : maxWidth - node.prefix.length - node.connector.length
  return (
    <box style={{ flexDirection: "row" }}>
      <text fg={mutedColor}>{node.prefix}{node.connector}</text>
      <text fg={textColor}>{truncateToWidth(node.displayPath, available)}</text>
    </box>
  )
}

/**
 * DirectoryTreeView component
 * Renders a directory tree with file status colors and click-to-scroll support
 */
export function DirectoryTreeView({
  files,
  onFileSelect,
  themeName,
  maxWidth,
}: DirectoryTreeViewProps): React.ReactElement | null {
  const nodes = React.useMemo(() => buildDirectoryTree(files), [files])
  const resolvedTheme = getResolvedTheme(themeName)
  const mutedColor = rgbaToHex(resolvedTheme.textMuted)
  const textColor = rgbaToHex(resolvedTheme.text)

  if (nodes.length === 0) {
    return null
  }

  return (
    <box
      style={{
        alignSelf: "center",
        flexDirection: "column",
      }}
    >
      {nodes.map((node, idx) => (
        <TreeNodeLine
          key={idx}
          node={node}
          theme={resolvedTheme}
          mutedColor={mutedColor}
          textColor={textColor}
          maxWidth={maxWidth}
          onSelect={
            node.isFile && node.fileIndex !== undefined && onFileSelect
              ? () => onFileSelect(node.fileIndex!)
              : undefined
          }
        />
      ))}
    </box>
  )
}
