#!/bin/bash
# ETL Platform - Script de inicialização local
# Execute com: bash start-local.sh

echo ""
echo "================================================"
echo "  ETL Platform - Iniciando..."
echo "================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js não encontrado. Instale em: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v)
echo "✅ Node.js $NODE_VER encontrado"

# Backend
echo ""
echo "📦 Instalando dependências do backend..."
cd "$(dirname "$0")/backend"
npm install --silent

echo "🚀 Iniciando backend na porta 3001..."
npm run dev &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# Frontend
echo ""
echo "📦 Instalando dependências do frontend..."
cd "../frontend"
npm install --silent

echo "🌐 Iniciando frontend na porta 5173..."
npm run dev &
FRONTEND_PID=$!

sleep 2

echo ""
echo "================================================"
echo "  ✅ ETL Platform está rodando!"
echo ""
echo "  🌐 Acesse: http://localhost:5173"
echo ""
echo "  📧 Login:  admin@etlplatform.com"
echo "  🔑 Senha:  Admin@123456"
echo ""
echo "  Pressione Ctrl+C para parar tudo"
echo "================================================"
echo ""

# Keep running until Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Servidores encerrados.'; exit 0" INT
wait $BACKEND_PID $FRONTEND_PID
