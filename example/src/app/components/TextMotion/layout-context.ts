'use client';

import { createContext } from 'react';

/** A containing control joins the text renderer's clock. It must write only
 * its own geometry and must not read layout on each frame. */
interface TextMotionLayoutParticipant {
  update(time: number, duration: number): void;
  render(time: number): boolean;
  settle(): void;
}
const TextMotionLayoutContext = createContext<{
  participant: TextMotionLayoutParticipant;
  revision: unknown;
} | null>(null);

export { TextMotionLayoutContext };
export type { TextMotionLayoutParticipant };
