import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  prefix?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  prefix,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col w-full">
      {label && <label className="mb-1 text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-500 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          className={`w-full px-4 py-3 rounded-xl border ${error ? 'border-red text-red focus:ring-red' : 'border-gray-300 focus:border-sunset focus:ring-sunset'} focus:outline-none focus:ring-2 focus:ring-offset-0 bg-white text-black transition-colors ${prefix ? 'pl-12' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="mt-1 text-sm text-red">{error}</span>}
    </div>
  );
};
