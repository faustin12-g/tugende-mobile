import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  withPadding?: boolean;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  withPadding = true
}) => {
  return (
    <div
      className={`min-h-dvh bg-white text-black flex flex-col ${
        withPadding
          ? 'overflow-y-auto overscroll-y-contain px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
