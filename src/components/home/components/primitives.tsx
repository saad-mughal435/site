/* =========================================================
   PRIMITIVES - Reveal, WordReveal, ScrollProgress, TiltCard,
   MagneticBtn. Behaviour verbatim from home.app.jsx.
   ========================================================= */
import { Fragment, useRef } from 'react';
import type { ElementType, ReactNode } from 'react';
import { useInView, useScrollProgress } from '../hooks';

interface RevealProps {
  children?: ReactNode;
  className?: string;
  stagger?: boolean;
  as?: ElementType;
  [key: string]: unknown;
}

export function Reveal({ children, className = '', stagger = false, as: Tag = 'div', ...rest }: RevealProps) {
  const ref = useRef<Element | null>(null);
  const inView = useInView(ref);
  return (
    <Tag
      ref={ref}
      className={(stagger ? 'stagger ' : 'reveal ') + (inView ? 'inView ' : '') + className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function ScrollProgress() {
  const p = useScrollProgress();
  return <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${p / 100})` }} />;
}

interface WordRevealProps {
  children?: ReactNode;
  className?: string;
  as?: ElementType;
}

export function WordReveal({ children, className = '', as: Tag = 'span' }: WordRevealProps) {
  const ref = useRef<Element | null>(null);
  const inView = useInView(ref, { threshold: 0.2 });
  const text = typeof children === 'string' ? children : '';
  if (!text) return <Tag className={className} ref={ref}>{children}</Tag>;
  const words = text.split(' ');
  return (
    <Tag ref={ref} className={'word-reveal ' + className + (inView ? ' inView' : '')}>
      {words.map((w, i) => (
        // The inter-word space lives OUTSIDE the inline-block span. A trailing
        // space inside an inline-block box is trimmed, which would mash the
        // words together ("A short" -> "Ashort"); as a sibling text node it
        // renders as a real space and still wraps normally.
        <Fragment key={i}>
          <span className="wr-word" style={{ transitionDelay: (i * 70) + 'ms' }}>{w}</span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </Tag>
  );
}

// Static card + button wrappers. Kept as thin components so call sites stay
// unchanged; the 3D-tilt and magnetic-follow effects were removed for a calmer,
// more professional feel. `intensity` is accepted and ignored.
interface TiltCardProps {
  children?: ReactNode;
  intensity?: number;
  className?: string;
  tag?: ElementType;
  [key: string]: unknown;
}

export function TiltCard({ children, intensity, className = '', tag: Tag = 'div', ...rest }: TiltCardProps) {
  return <Tag className={className} {...rest}>{children}</Tag>;
}

interface MagneticBtnProps {
  as?: ElementType;
  children?: ReactNode;
  className?: string;
  [key: string]: unknown;
}

export function MagneticBtn({ as: Tag = 'a', children, className = 'btn btn-primary', ...rest }: MagneticBtnProps) {
  return <Tag className={className} {...rest}>{children}</Tag>;
}
