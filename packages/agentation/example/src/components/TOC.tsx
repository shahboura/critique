'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useActiveScrollElement } from '../hooks/useActiveScrollElement';

type Heading = {
  id: string;
  level: number;
  text: string;
};

type TableOfContentsProps = React.HTMLAttributes<HTMLElement> & {
  headings: Heading[];
  pageHref: string;
  title?: string;
};

/** Table of Contents with scrollspy and animated indicator */
export const TOC: React.FC<TableOfContentsProps> = ({
  headings,
  pageHref,
  title = 'On This Page',
  ...props
}) => {
  const isCurrentPage = usePathname() === pageHref;
  const activeLink = React.useRef<HTMLAnchorElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({});
  const ids = React.useMemo(() => isCurrentPage ? headings.map((h) => h.id) : [], [headings, isCurrentPage]);
  const activeHeading = useActiveScrollElement(ids);

  React.useEffect(() => {
    if (activeLink.current) {
      setStyle({
        top: activeLink.current.offsetTop + 'px',
        height: activeLink.current.offsetHeight + 'px',
      });
    }
  }, [activeHeading, headings]);

  return (
    <aside data-toc="" aria-hidden={!isCurrentPage || undefined} {...props}>
      {title && <span data-toc-title="">{title}</span>}

      <ul
        data-toc-list=""
        style={{
          ['--active-top' as string]: style.top,
          ['--active-height' as string]: style.height,
        }}
      >
        {headings.map(({ id, text, level }) => {
          const isActive = activeHeading === id;

          return (
            <li key={id} data-toc-item="" data-level={level}>
              <a
                href={`${pageHref}#${id}`}
                tabIndex={isCurrentPage ? undefined : -1}
                ref={isActive ? activeLink : null}
                aria-current={isActive ? "location" : undefined}
              >
                {text}
              </a>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
