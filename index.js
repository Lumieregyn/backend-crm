
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/conversa', async (req, res) => {
    const { cliente, vendedor, checklist, alertas } = req.body;

    const faltando = Object.entries(checklist)
        .filter(([_, value]) => value === false)
        .map(([key, _]) => `⚠️ Falta confirmar: ${key}`);

    const textoAlerta = `
🚨 *Alerta de Atendimento Incompleto* 🚨

👤 *Cliente:* ${cliente}
👩‍💼 *Vendedor:* ${vendedor}

${faltando.join("\n")}

Recomenda-se validar os pontos pendentes antes de finalizar o pedido.
    `;

    // Enviar alerta para o número do vendedor ou gestor
    try {
        const response = await axios.post('https://api.suri.app/send-message', {
            number: process.env.TELEFONE_DESTINO,  // Número do vendedor/gestor no formato internacional
            message: textoAlerta.trim()
        }, {
            headers: {
                Authorization: `Bearer ${process.env.SURI_TOKEN}`
            }
        });

        res.json({ status: "ok", enviado: true, retorno: response.data });
    } catch (error) {
        res.json({ status: "erro", enviado: false, erro: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
