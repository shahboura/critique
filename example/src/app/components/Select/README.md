# Docs Select

A local adaptation of the shared select: Radix keyboard/typeahead and focus handling, reversible surface motion, trigger toggling, and scroll-edge behavior. It uses the existing local text renderer for value changes. Only the docs need this dependency; nothing is exported by the toolbar package.

The viewport uses effect cleanup for React 18. This wrapper exposes only the value, options, label and change handler used by the agent setup control.

The trigger deliberately does not scale on press. Its resting bounds anchor the popup position and minimum width; shrinking it causes the menu to move and resize on release. Hover feedback and popup entrance motion remain independent.
