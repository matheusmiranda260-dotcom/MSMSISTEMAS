import React, { useState, useEffect } from 'react';
import { ClockIcon } from '../icons';

const MobileFriendlyDateInput: React.FC<{
    label: string;
    value: string | null | undefined;
    onChange: (val: string) => void;
    disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => {
    // Internal state for text input (DD/MM/YYYY)
    const [textValue, setTextValue] = useState('');

    useEffect(() => {
        if (value) {
            const [y, m, d] = value.split('-');
            setTextValue(`${d}/${m}/${y}`);
        } else {
            setTextValue('');
        }
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
        if (val.length > 8) val = val.substring(0, 8);

        // Simple mask logic
        let formatted = val;
        if (val.length >= 3) formatted = `${val.substring(0, 2)}/${val.substring(2)}`;
        if (val.length >= 5) formatted = `${formatted.substring(0, 5)}/${formatted.substring(5)}`;

        setTextValue(formatted);

        // Parse if complete
        if (val.length === 8) {
            const day = val.substring(0, 2);
            const month = val.substring(2, 4);
            const year = val.substring(4, 8);
            // Basic validity check
            const date = new Date(`${year}-${month}-${day}`);
            if (!isNaN(date.getTime())) {
                onChange(`${year}-${month}-${day}`);
            }
        } else if (val.length === 0) {
            onChange('');
        }
    };

    const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase">{label}</label>
            <div className="relative mt-1">
                <input
                    type="text"
                    disabled={disabled}
                    placeholder="DD/MM/AAAA"
                    className="w-full p-2 border rounded-lg disabled:bg-slate-100 pr-10"
                    value={textValue}
                    onChange={handleTextChange}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <div className="relative">
                        <input
                            type="date"
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            onChange={handleDateSelect}
                            value={value || ''}
                            disabled={disabled}
                        />
                        <button type="button" tabIndex={-1} className="text-slate-400 hover:text-blue-500">
                            <ClockIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileFriendlyDateInput;
