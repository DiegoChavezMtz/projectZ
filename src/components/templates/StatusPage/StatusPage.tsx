import type { ReactNode } from 'react';
import styles from './StatusPage.module.css';

type Props = {
  code?: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function StatusPage({ code, title, description, children }: Props) {
  return (
    <main className={styles.root}>
      <div className={styles.panel}>
        {code ? <p className={styles.code}>{code}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children}
      </div>
    </main>
  );
}

type ActionProps = { label: string } & ({ href: string } | { onClick: () => void });

export function StatusPageAction(props: ActionProps) {
  if ('href' in props) {
    return (
      <a className={styles.action} href={props.href}>
        {props.label}
      </a>
    );
  }
  return (
    <button type="button" className={styles.action} onClick={props.onClick}>
      {props.label}
    </button>
  );
}
