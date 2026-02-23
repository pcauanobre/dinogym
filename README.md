# DinoGym

> Aplicativo pessoal para acompanhar sua evolução na academia — treinos, cargas, PRs e progresso ao longo do tempo.

---

## Funcionalidades

### Treino
- Inicia e finaliza sessões de treino com cronômetro
- Registra séries, repetições e carga por exercício
- Detecta automaticamente novos **recordes pessoais (PRs)** e compara com o histórico
- Modo multi-set com controle individual por série (pode pular séries)
- Edição de entradas após registrar
- Avaliação do treino ao finalizar (1–5 estrelas)

### Histórico
- Mini calendário com os dias em que você treinou
- Detalhes de cada sessão: exercícios, cargas, duração, PRs batidos
- Indicadores visuais — verde (subiu), cinza (manteve), vermelho (caiu)

### Rotina semanal
- Define a rotina de cada dia da semana com máquinas e séries/reps sugeridas
- Carousel de dias no Home com destaque no dia atual
- Labels personalizados por dia (ex: "Peito A", "Costas B")

### Relatório
- Frequência mensal com gráfico de treinos por semana
- Progressão de carga e repetições por máquina (gráfico de linha por semana)
- Recorde pessoal atual por exercício
- Resumo do mês: total de treinos, PRs batidos, máquinas mais usadas

### Máquinas
- Cadastro de máquinas com nome, categoria e foto
- Foto gerada automaticamente por categoria (se não tiver imagem própria)
- Filtro por categoria

### Offline mode
- Treinos registrados offline são salvos localmente
- Sincronização automática quando a conexão é restaurada
- Banner de status de conectividade

### Autenticação
- Admin loga com **e-mail + senha**
- Membros logam com **CPF + senha** (após definir a senha no primeiro acesso)
- Tokens JWT com validade de 7 dias
- "Manter sessão" salva no `localStorage`, caso contrário usa `sessionStorage`

---

## Tech stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express |
| ORM | Prisma |
| Banco de dados | PostgreSQL (Neon) |
| Autenticação | JWT + bcryptjs |
| Frontend | React + Vite |
| UI | Material UI (MUI) v5 |
| Gráficos | Recharts |
| Deploy backend | Render |
| Deploy frontend | Vercel |

---

## Estrutura do projeto

```
dinogym/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # modelos do banco
│   │   └── seed.js                # dados iniciais (admin + histórico de exemplo)
│   └── src/
│       ├── index.js               # entrada da API (Express)
│       ├── lib/prisma.js          # cliente Prisma singleton
│       ├── middleware/auth.js     # validação JWT + RBAC
│       └── routes/
│           ├── auth.routes.js     # login, primeiro acesso
│           ├── machines.routes.js # CRUD de máquinas
│           ├── routine.routes.js  # rotina semanal
│           ├── sessions.routes.js # sessões de treino e entradas
│           └── users.routes.js    # perfil, foto, membros
└── frontend/
    └── src/
        ├── components/            # BottomNav, SwipeNav, Glass, ExerciseThumbnail
        ├── constants/             # categorias, labels de dias/meses, tema
        ├── pages/
        │   ├── Login.jsx
        │   ├── Home.jsx
        │   ├── Maquinas.jsx
        │   ├── Rotina.jsx
        │   ├── Relatorio.jsx
        │   └── treino/            # Treino + dialogs extraídos
        └── utils/                 # api, authStorage, offlineQueue, simDay
```

---

## Setup local

### Pré-requisitos
- Node.js 18+
- Conta no [Neon](https://neon.tech) (PostgreSQL gratuito)

### 1. Configurar variáveis de ambiente

**`backend/.env`**
```env
DATABASE_URL="postgresql://usuario:senha@host/dinogym?sslmode=require"
JWT_SECRET="qualquer_string_secreta"
ADMIN_EMAIL="admin@dinogym.com"
ADMIN_PASSWORD="suasenha"
ADMIN_NAME="Admin"
CORS_ORIGINS="http://localhost:5173"
PORT=3001
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:3001
```

### 2. Backend

```bash
cd backend
npm install
npx prisma db push       # cria as tabelas
node prisma/seed.js      # cria o admin e dados de exemplo
npm run dev              # API em localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev              # app em localhost:5173
```

---

## Deploy

### Backend → Render

1. Crie um **Web Service** apontando para a pasta `backend`
2. Build: `npm install && npx prisma generate`
3. Start: `node src/index.js`
4. Configure as variáveis de ambiente (`.env` com valores de produção)
5. Em `CORS_ORIGINS` coloque a URL do Vercel

### Frontend → Vercel

1. Crie um projeto apontando para a pasta `frontend`
2. Adicione `VITE_API_URL` com a URL do Render
3. Deploy automático a cada push na `main`

---

## Branches

| Branch | Uso |
|---|---|
| `main` | produção — deploy automático |
| `dev` | desenvolvimento ativo |

---

## Comandos úteis

```bash
# Sincronizar schema com o banco
cd backend && npx prisma db push

# Visualizar o banco no browser
cd backend && npx prisma studio

# Recriar dados de exemplo
cd backend && node prisma/seed.js
```

---

> Projeto pessoal — uso próprio para acompanhar treinos e evolução de cargas.
