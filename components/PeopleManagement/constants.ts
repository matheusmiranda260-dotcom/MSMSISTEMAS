export interface QuestionConfig {
    id: string;
    section: string;
    text: string;
    correct: string;
    options: string[];
}

export const TREFILA_QUESTIONS: QuestionConfig[] = [
    {
        id: 'q1',
        section: 'Matéria-Prima (Entrada)',
        text: 'Qual é o nome técnico da matéria-prima que utilizamos na trefila?',
        correct: 'Fio Máquina',
        options: ['Fio Máquina', 'Vergalhão CA50', 'Bobina Laminada a Frio', 'Arame Recozido']
    },
    {
        id: 'q2',
        section: 'Matéria-Prima (Entrada)',
        text: 'Quais são as bitolas de Fio Máquina que temos disponíveis hoje para o processo?',
        correct: '8.00mm, 6.50mm, 6.35mm e 5.50mm',
        options: [
            '8.00mm, 6.50mm, 6.35mm e 5.50mm',
            '10.00mm, 8.00mm, 6.00mm e 4.20mm',
            '12.50mm, 10.00mm, 8.00mm e 6.30mm',
            '8.00mm, 7.00mm, 6.00mm e 5.00mm'
        ]
    },
    {
        id: 'q3',
        section: 'Produto Final (Saída)',
        text: 'Como chamamos comercialmente o produto que sai da nossa trefila?',
        correct: 'Rolo CA60 (ou Aço CA60)',
        options: ['Rolo CA60 (ou Aço CA60)', 'Vergalhão CA50', 'Arame Recozido Galvanizado', 'Treliça Eletrosoldada H8']
    },
    {
        id: 'q4',
        section: 'Produto Final (Saída)',
        text: 'Cite 5 bitolas diferentes que produzimos na trefila após o processo de redução.',
        correct: '6.0mm, 5.8mm, 5.6mm, 5.0mm, 4.2mm, 4.1mm, 3.8mm',
        options: [
            '6.0mm, 5.8mm, 5.6mm, 5.0mm, 4.2mm, 4.1mm, 3.8mm',
            '12.0mm, 10.0mm, 8.0mm, 6.3mm, 5.0mm',
            '8.0mm, 6.5mm, 6.35mm, 5.5mm, 3.2mm',
            '4.2mm, 3.8mm, 3.4mm, 3.0mm, 2.8mm'
        ]
    },
    {
        id: 'q5',
        section: 'Aplicação (Valor)',
        text: 'O Rolo CA60 que produzimos é a matéria-prima principal para quais produtos finais na nossa fábrica?',
        correct: 'Fabricação de Treliças, Vergalhões (corte e dobra) e Estribos',
        options: [
            'Fabricação de Treliças, Vergalhões (corte e dobra) e Estribos',
            'Lajes Treliçadas, Pregos e Telas Soldadas',
            'Chapas Finas, Tubos de Aço e Vigas U',
            'Arame Farpado, Pregos e Cordoalhas'
        ]
    }
];


export const TRELICA_QUESTIONS: QuestionConfig[] = [
    {
        id: 'q1',
        section: 'Codificação e Identificação',
        text: 'Como identificamos nossos modelos de treliça na produção?',
        correct: 'Pela letra "H" seguida do número que indica a altura (ex: H8, H12)',
        options: [
            'Pela letra "H" seguida do número que indica a altura (ex: H8, H12)',
            'Pela letra "T" seguida do peso por metro (ex: T8, T12)',
            'Pela bitola do ferro inferior (ex: 3.8, 4.2)',
            'Pela letra "V" seguida do vão máximo suportado (ex: V8, V12)'
        ]
    },
    {
        id: 'q2',
        section: 'Codificação e Identificação',
        text: 'Se eu pedir uma H12, o que esse "12" representa?',
        correct: 'A altura da treliça (em centímetros)',
        options: [
            'A altura da treliça (em centímetros)',
            'O comprimento da barra (em metros)',
            'A bitola do ferro superior (em milímetros)',
            'O número de senoides por metro'
        ]
    },
    {
        id: 'q3',
        section: 'Estrutura e Composição',
        text: 'Descreva a disposição dos ferros em uma treliça padrão.',
        correct: '1 ferro superior, 2 ferros na senoide (zigue-zague) e 2 ferros inferiores',
        options: [
            '1 ferro superior, 2 ferros na senoide (zigue-zague) e 2 ferros inferiores',
            '2 ferros superiores, 1 ferro na senoide e 1 ferro inferior',
            '1 ferro superior, 1 ferro na senoide e 2 ferros inferiores',
            '2 ferros superiores, 2 ferros na senoide e 2 ferros inferiores'
        ]
    },
    {
        id: 'q4',
        section: 'Padronização',
        text: 'Quais são os comprimentos padrão das barras que produzimos?',
        correct: '6 metros e 12 metros',
        options: [
            '6 metros e 12 metros',
            '8 metros e 10 metros',
            '5 metros e 10 metros',
            '6 metros e 9 metros'
        ]
    },
    {
        id: 'q5',
        section: 'Demonstração de Domínio (O "Caso Real")',
        text: 'Escolha um modelo que você domina (ex: H12 Leve) e me detalhe as bitolas utilizadas nele.',
        correct: 'H12 Leve -> Superior: 5.8mm | Senoide: 3.2mm | Inferior: 3.8mm',
        options: [
            'H12 Leve -> Superior: 5.8mm | Senoide: 3.2mm | Inferior: 3.8mm',
            'H12 Leve -> Superior: 6.0mm | Senoide: 3.8mm | Inferior: 4.2mm',
            'H12 Leve -> Superior: 5.0mm | Senoide: 3.2mm | Inferior: 4.2mm',
            'H12 Leve -> Superior: 8.0mm | Senoide: 3.2mm | Inferior: 5.8mm'
        ]
    }
];


export const resizeImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
    return new Promise((resolve, reject) => {
        if (!file.type.match(/image.*/)) {
            resolve(file); // Not an image, return original
            return;
        }
        const reader = new FileReader();
        reader.onload = (readerEvent: any) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                let width = image.width;
                let height = image.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(image, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const byteString = atob(dataUrl.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: 'image/jpeg' });
                    const resizedFile = new File([blob], file.name, { type: 'image/jpeg' });
                    resolve(resizedFile);
                } else {
                    resolve(file); // Fallback
                }
            };
            image.src = readerEvent.target.result;
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
};

// Funções utilitárias para evitar bugs de fuso horário (timezone shift) no JavaScript

