from google import genai

# Cria a conexão automática com o Gemini
client = genai.Client()

print("Conectando ao Gemini do Google...")

try:
    # Faz a pergunta para a IA
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Gere uma função simples em Python para testar se a IA está funcionando.'
    )
    print("\n--- RESPOSTA DA IA: ---")
    print(response.text)
except Exception as e:
    print(f"\nErro ao conectar: {e}")