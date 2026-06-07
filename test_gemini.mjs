import fs from 'fs';

let API_KEY = "";
try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    const match = envContent.match(/VITE_GEMINI_API_KEY\s*=\s*(.*)/);
    if (match) {
        API_KEY = match[1].trim();
    }
} catch (e) {
    console.error("Erro ao ler o arquivo .env", e);
}

async function listModels() {
    try {
        console.log("Testando chave:", API_KEY);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

listModels();
