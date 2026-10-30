import { useEffect, useState } from 'react';

type Options = {
  defaultActive?: string;
  vhFromTopOfPage?: number;
};

/** Follow the rendered headings without changing or locking the page's scroll. */
export function useActiveScrollElement(ids: string[], options: Options = {}) {
  const { defaultActive = ids[0], vhFromTopOfPage = 15 } = options;
  const [active, setActive] = useState<string | undefined>(defaultActive);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    let frame = 0;

    function update() {
      frame = 0;
      const activationLine = Math.min(window.innerHeight * vhFromTopOfPage / 100, 120);
      let current = sections[0]?.id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= activationLine) current = section.id;
      }
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1]?.id;
      }
      setActive(current);
    }

    function scheduleUpdate() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    update();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(document.body);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
      window.removeEventListener('pageshow', scheduleUpdate);
    };
  }, [ids, vhFromTopOfPage]);

  return ids.includes(active ?? '') ? active : defaultActive;
}
