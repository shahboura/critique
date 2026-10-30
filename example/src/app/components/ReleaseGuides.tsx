import { CodeBlock } from "./CodeBlock";

export function ReleaseGuides() {
  return (
    <>
      <section>
        <h2 id="copy-formats">Identify your app and choose what to copy</h2>
        <p>Use <code>appName</code> to distinguish feedback from different apps. By default, Copy produces markdown with the selected elements and your notes.</p>
        <CodeBlock code={`<Agentation appName="Checkout preview" />`} />
        <p>For a smaller output, copy source paths, CSS classes, or one identifying attribute. Each format returns unique values on separate lines.</p>
        <CodeBlock code={`<Agentation copyFormat="source" />
<Agentation copyFormat="classes" />
<Agentation copyFormat={{ attribute: "data-qa" }} />`} />
        <p>Attribute mode captures the requested attribute automatically. When the selected element has a value, you can save it without writing a comment. Missing metadata leaves the clipboard and saved feedback intact.</p>
        <p><code>copyFormat</code> also changes the text passed to <code>onCopy</code>. It does not change Send: <code>onSubmit</code> still receives structured markdown and the annotation array. With <code>{"copyToClipboard={false}"}</code>, your <code>onCopy</code> callback handles delivery.</p>
      </section>
      <section>
        <h2 id="identifying-attributes">Stable element identifiers</h2>
        <p>Agentation captures <code>data-testid</code>, <code>data-test</code>, <code>data-qa</code>, <code>data-cy</code> and <code>data-component</code> by default. Supply <code>identifyingAttributes</code> to replace that list.</p>
        <CodeBlock code={`<Agentation identifyingAttributes={["data-testid", "data-qa"]} />`} />
        <p>Values are available in <code>annotation.attributes</code>. Up to two short data attributes also appear in the element selector. Capture is limited to 16 names and 500 characters per value. Choose identifiers intended to be shared with your agent.</p>
      </section>
      <section>
        <h2 id="open-in-editor">Open the source in your editor</h2>
        <p>Provide <code>onOpenSource</code> to add an Open in editor action to the feedback popup. It receives the detected file reference, such as <code>src/Checkout.tsx:24:5</code>.</p>
        <CodeBlock code={`<Agentation onOpenSource={(sourceFile) => openInEditor(sourceFile)} />`} />
        <p><code>openInEditor</code> is your app’s editor integration. The action stays hidden if a trustworthy source location is unavailable. React development metadata is best effort; a production build needs source metadata supplied at build time.</p>
      </section>
      <section>
        <h2 id="host-overlays">Annotate a modal or popover</h2>
        <p>Pass the active overlay’s content element as <code>portalContainer</code>. A callback ref lets Agentation move its existing portal as the overlay opens and closes, preserving feedback state.</p>
        <CodeBlock code={`import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Agentation } from "agentation";

export function App() {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  return (
    <>
      <Dialog.Root>
        <Dialog.Trigger>Open settings</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup ref={setContainer}>
            <Dialog.Title>Settings</Dialog.Title>
            {/* Your settings form */}
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <Agentation portalContainer={container} />
    </>
  );
}`} />
        <p>The container must belong to the same document. Browsers with the Popover API keep Agentation in the top layer while its DOM remains inside the overlay’s focus boundary. Older browsers use an ordinary portal, so host overflow and transforms can still affect placement. Other modal libraries may need additional focus integration.</p>
      </section>
      <section>
        <h2 id="embedded-pages">Same-origin embedded pages</h2>
        <p>Select elements inside same-origin iframes, including nested frames and open shadow roots. Single-element markers follow child scrolling and axis-aligned frame scaling. They hide when their target leaves the frame viewport or the frame navigates, and return with the original number when visible again.</p>
        <p>Cross-origin contents cannot be inspected. You can still select the iframe element itself. Rotated or skewed frames and live multi-element groups across frame boundaries are outside this support.</p>
      </section>
      <section>
        <h2 id="routing-and-shortcuts">Routing and keyboard control</h2>
        <p>For a hash router, enable <code>useHashLocation</code> so <code>/app#/inbox</code> and <code>/app#/settings</code> retain separate notes, layout state and default MCP sessions.</p>
        <CodeBlock code={`<Agentation useHashLocation />`} />
        <p>Hash changes and browser Back/Forward are tracked. If your router changes history without a navigation event, render Agentation from a component subscribed to that router’s location. Unsaved popup text is cancelled on navigation; saved feedback stays with its route. Query strings do not create separate feedback buckets. Existing pathname-only data stays in its original bucket.</p>
        <p>For an app with its own keyboard shortcuts, turn off Agentation’s global shortcuts. The toolbar buttons and Enter/Escape within feedback popups remain usable.</p>
        <CodeBlock code={`<Agentation enableKeyboardShortcuts={false} />`} />
      </section>
    </>
  );
}
