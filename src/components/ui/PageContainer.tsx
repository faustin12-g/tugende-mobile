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
    <div className={`min-h-screen bg-white text-black flex flex-col ${withPadding ? 'px-6 py-8' : ''} ${className}`}>
      {children}
    </div>
  );
};
