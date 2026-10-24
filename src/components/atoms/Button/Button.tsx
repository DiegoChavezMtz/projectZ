import clsx from 'clsx';
import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../Spinner';
import styles from './Button.module.css';

type CommonProps = {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: ReactNode;
};

type ButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
    /** Deshabilita el botón y marca `aria-busy` mientras la acción está en curso. */
    loading?: boolean;
  };

type LinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
    loading?: undefined;
  };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', fullWidth = false, children } = props;
  const classes = clsx(
    styles.root,
    styles[variant],
    styles[size],
    fullWidth && styles.full,
    props.className,
  );

  if (props.href !== undefined) {
    const { href, className, ...rest } = pickDom(props);
    void className;
    // Rutas internas con navegación de Next; anclas y enlaces externos con <a>.
    if (href.startsWith('/') && !href.startsWith('//')) {
      return (
        <Link href={href} className={classes} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  const { loading = false, disabled, type = 'button', className, ...rest } = pickDom(props);
  void className;
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size="sm" decorative /> : null}
      {children}
    </button>
  );
}

/** Quita los props propios del Button (no son atributos DOM). */
function pickDom<T extends CommonProps>(props: T) {
  const rest: Partial<T> = { ...props };
  delete rest.variant;
  delete rest.size;
  delete rest.fullWidth;
  delete rest.children;
  return rest as Omit<T, keyof CommonProps>;
}
