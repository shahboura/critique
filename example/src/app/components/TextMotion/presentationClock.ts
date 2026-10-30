/** Preparation is not presentation. A synchronous React/theme/layout commit
 * may outlast the transition before the browser can draw its first frame.
 * Hold only that unpresented interval, then use ordinary elapsed time. The
 * text model and any containing geometry receive this same local clock. */
function createPresentationClock() {
  let offset = 0;
  let held: number | undefined;
  return {
    read(wallTime: number) {
      return held ?? wallTime - offset;
    },
    hold(time: number) {
      held = time;
    },
    present(wallTime: number) {
      if (held !== undefined) {
        offset = wallTime - held;
        held = undefined;
      }
      return wallTime - offset;
    },
  };
}

export { createPresentationClock };
