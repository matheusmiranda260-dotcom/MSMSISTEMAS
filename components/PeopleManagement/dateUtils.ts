export const formatDbDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
    }
    return new Date(dateStr).toLocaleDateString('pt-BR');
};

export const getDurationDays = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const startParts = startStr.split('T')[0].split('-');
    const endParts = endStr.split('T')[0].split('-');
    if (startParts.length === 3 && endParts.length === 3) {
        const startDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
        const endDate = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
        return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    return 0;
};

export const isDateWithinRange = (dateStr: string, startStr: string, endStr: string): boolean => {
    if (!dateStr || !startStr || !endStr) return false;
    const date = new Date(dateStr.split('T')[0] + 'T00:00:00');
    const start = new Date(startStr.split('T')[0] + 'T00:00:00');
    const end = new Date(endStr.split('T')[0] + 'T00:00:00');
    return date >= start && date <= end;
};

export const getAvailablePeriods = (admissionDateStr: string | null | undefined): string[] => {
    const periods: string[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();

    if (admissionDateStr) {
        const parts = admissionDateStr.split('-');
        if (parts.length === 3) {
            const admYear = parseInt(parts[0]);
            for (let y = admYear; y <= currentYear + 1; y++) {
                periods.push(y.toString());
            }
            return periods.reverse();
        }
    }

    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
        periods.push(y.toString());
    }
    return periods.reverse();
};

export const getPeriodDeadline = (admissionDateStr: string | null | undefined, periodYearStr: string): Date | null => {
    if (!admissionDateStr || !periodYearStr) return null;
    const parts = admissionDateStr.split('-');
    if (parts.length !== 3) return null;
    const admMonth = parseInt(parts[1]) - 1;
    const admDay = parseInt(parts[2]);
    const periodYear = parseInt(periodYearStr);
    
    const deadline = new Date(periodYear + 2, admMonth, admDay);
    deadline.setDate(deadline.getDate() - 1);
    return deadline;
};
