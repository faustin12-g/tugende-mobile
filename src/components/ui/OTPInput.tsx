import { useRef, useState, useEffect, type FC } from 'react';

export interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export const OTPInput: FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error
}) => {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const valArr = value.split('').slice(0, length);
    const newOtp = Array(length).fill('');
    valArr.forEach((char, index) => {
      newOtp[index] = char;
    });
    setOtp(newOtp);
  }, [value, length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (/[^0-9]/.test(val)) return;

    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    const newString = newOtp.join('');
    onChange(newString);

    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-2">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border focus:outline-none focus:ring-2 focus:ring-sunset transition-colors ${digit ? 'bg-gray-50 border-sunset' : 'bg-white border-gray-300'} ${error ? 'border-red focus:ring-red' : ''}`}
          />
        ))}
      </div>
      {error && <span className="mt-2 text-sm text-red">{error}</span>}
    </div>
  );
};
