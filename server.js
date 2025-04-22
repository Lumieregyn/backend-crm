
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const TINY_API_TOKEN = 'SEU_TOKEN_AQUI'; // Substituir pelo seu token real

let propostasPlanilha = [];

// Upload de planilha
app.post('/upload-planilha', upload.single('file'), (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    propostasPlanilha = rows.map((row, idx) => ({
      id: idx + 1,
      cliente: row.Cliente || '',
      vendedor: row.Vendedor || '',
      valor: row.Valor || 0,
      tag_crm: row.Tag_CRM || '',
      etapaAtual: '📄 Proposta Criada'
    }));

    res.json({ sucesso: true, propostas: propostasPlanilha });
  } catch (err) {
    console.error('Erro ao processar planilha:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao processar a planilha' });
  }
});

// Sincronização com Tiny
app.get('/sincronizar-com-tiny', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.tiny.com.br/api2/pedidos.pesquisa.php',
      new URLSearchParams({
        token: TINY_API_TOKEN,
        formato: 'json'
      })
    );

    const pedidos = response.data.retorno.pedidos || [];

    const resultados = [];

    for (const proposta of propostasPlanilha) {
      const pedidoRelacionado = pedidos.find(p => {
        const obs = p.pedido?.observacoes || '';
        return obs.includes(proposta.tag_crm);
      });

      if (pedidoRelacionado) {
        const statusPedido = pedidoRelacionado.pedido.situacao.toLowerCase();

        let novaEtapa = proposta.etapaAtual;
        if (statusPedido.includes('cancelado')) {
          novaEtapa = '❌ Cancelados';
        } else if (statusPedido.includes('finalizado')) {
          novaEtapa = '✅ Venda Fechada';
        }

        resultados.push({
          ...proposta,
          pedido_id: pedidoRelacionado.pedido.numero,
          status_pedido: statusPedido,
          novaEtapa
        });
      } else {
        resultados.push({ ...proposta, status_pedido: 'não encontrado', novaEtapa: proposta.etapaAtual });
      }
    }

    res.json({ sucesso: true, cruzamento: resultados });
  } catch (err) {
    console.error('Erro na API da Tiny:', err.message);
    res.status(500).json({ sucesso: false, erro: 'Erro na sincronização com a Tiny' });
  }
});

app.listen(port, () => {
  console.log(`🔁 Backend CRM rodando na porta ${port}`);
});
