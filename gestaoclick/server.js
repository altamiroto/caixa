// server.js
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Configurações da sua API
const API_URL = 'https://api.beteltecnologia.com/produtos?limite_por_pagina=10';
const ACCESS_TOKEN = '70b21a45cc992f08ece8f384072e0fba9b4bd034';
const SECRET_ACCESS_TOKEN = 'b833ae75916e14c6359c8da95dfbb0f8961a0479';

// Habilita o CORS para permitir que sua página HTML local acesse este servidor
app.use(cors());

// Rota que sua página HTML irá chamar
app.get('/api/produtos', async (req, res) => {
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'access-token': ACCESS_TOKEN,
                'secret-access-token': SECRET_ACCESS_TOKEN
            }
        });

        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        res.json(data); // Envia os dados da API para o seu frontend
    } catch (error) {
        console.error('Falha ao buscar produtos:', error);
        res.status(500).json({ error: 'Falha ao buscar produtos', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});