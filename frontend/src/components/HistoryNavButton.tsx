import React from 'react';

interface HistoryNavButtonProps {
  className?: string;
  href?: string;
  onNavigate?: () => void;
}

export default function HistoryNavButton({ className, href = '#/history', onNavigate }: HistoryNavButtonProps) {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate) return;
    e.preventDefault();
    onNavigate();
  };

  return (
    <a href={href} className={className} onClick={onClick} aria-label="Open scan history">
      HISTORY
    </a>
  );
}

