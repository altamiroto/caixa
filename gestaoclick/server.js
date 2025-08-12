// server.js
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();

const API_URL = process.env.API_URL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const SECRET_ACCESS_TOKEN = process.env.SECRET_ACCESS_TOKEN;

app.use(cors());

// Rota para servir a página HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'produtos.html'));
});

// Rota da API que o HTML irá chamar
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
        res.json(data);
    } catch (error) {
        console.error('Falha ao buscar produtos:', error);
        res.status(500).json({ error: 'Falha ao buscar produtos', details: error.message });
    }
});

module.exports = app;
