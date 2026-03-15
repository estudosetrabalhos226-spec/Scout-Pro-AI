# Scout Pro AI ⚽📊

**Scout Pro AI** é uma plataforma avançada de gestão, análise e backtesting para trading esportivo.

## 🚀 Como Rodar o Projeto Localmente

Siga os passos abaixo para configurar o ambiente de desenvolvimento no seu computador.

### 1. Pré-requisitos

Certifique-se de ter instalado:
*   **Node.js** (Versão 18 ou superior recomendada)
*   **npm** (Vem junto com o Node.js)

### 2. Instalação

Clone o repositório e instale as dependências:

```bash
git clone https://github.com/seu-usuario/scout-pro-ai.git
cd scout-pro-ai
npm install
```

### 3. Configuração das Variáveis de Ambiente

O projeto utiliza o Google Gemini para IA e o Firebase para o banco de dados.

1.  Crie um arquivo chamado `.env.local` na raiz do projeto.
2.  Copie o conteúdo de `.env.example` para `.env.local`.
3.  Preencha as variáveis:
    *   `GEMINI_API_KEY`: Obtenha em [Google AI Studio](https://aistudio.google.com/app/apikey).
    *   Variáveis do Firebase: Você pode encontrá-las no seu [Console do Firebase](https://console.firebase.google.com/) em "Configurações do Projeto".

### 4. Execução

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:3000`.

## 🛠️ Tecnologias Utilizadas

*   **Frontend:** React, TypeScript, Tailwind CSS, Framer Motion, Recharts.
*   **Backend:** Node.js, Express (para servir o app e gerenciar rotas).
*   **Banco de Dados:** Firebase Firestore.
*   **Autenticação:** Firebase Auth (Google Login).
*   **IA:** Google Generative AI (Gemini).

## 🔐 Segurança

As regras de segurança do Firestore estão localizadas no arquivo `firestore.rules`. Certifique-se de publicá-las no seu console do Firebase para garantir a proteção dos dados dos usuários.

---

Desenvolvido para transformar dados em lucro. 🚀
