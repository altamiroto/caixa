// server.js
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Variáveis de ambiente lidas da Vercel
const API_URL = process.env.API_URL;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const SECRET_ACCESS_TOKEN = process.env.SECRET_ACCESS_TOKEN;

app.use(cors());

// Rota para servir a página HTML com os dados da API
app.get('/', async (req, res) => {
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
        
        // Geração do HTML com os dados
        let produtosHTML = '';
        if (data.data && data.data.length > 0) {
            data.data.forEach(produto => {
                const valorVendaVarejo = produto.valores.find(v => v.nome_tipo === 'Varejo');
                produtosHTML += `
                    <tr>
                        <td>${produto.id}</td>
                        <td>${produto.nome}</td>
                        <td>R$ ${parseFloat(produto.valor_custo).toFixed(2).replace('.', ',')}</td>
                        <td>R$ ${valorVendaVarejo ? parseFloat(valorVendaVarejo.valor_venda).toFixed(2).replace('.', ',') : 'N/A'}</td>
                    </tr>
                `;
            });
        } else {
            produtosHTML = '<tr><td colspan="4">Nenhum produto encontrado.</td></tr>';
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Acompanhamento de Produtos do CRM</title>
                <style>
                    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 20px; }
                    .container { background-color: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
                    h1 { color: #333; text-align: center; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
                    th { background-color: #007BFF; color: white; }
                    tr:nth-child(even) { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Produtos Cadastrados</h1>
                    <p>Esta lista de 10 produtos é carregada dinamicamente pelo servidor.</p>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Nome do Produto</th>
                                <th>Valor de Custo</th>
                                <th>Valor de Venda (Varejo)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${produtosHTML}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
        `;
        res.send(htmlContent);

    } catch (error) {
        console.error('Falha ao buscar produtos:', error);
        res.status(500).send(`
            <h1>Erro ao carregar dados</h1>
            <p>Falha ao carregar os dados: ${error.message}</p>
        `);
    }
});

module.exports = app;
