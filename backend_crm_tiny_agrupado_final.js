
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const TINY_API_TOKEN = 'SEU_TOKEN_REAL_INSERIDO';

let propostasAgrupadas = [];

function parseValor(valor) {
  if (typeof valor === 'string') {
    valor = valor.replace(/R\$|\s|\./g, '').replace(',', '.');
  }
  const parsed = parseFloat(valor);
  return isNaN(parsed) ? 0 : parsed;
}

function agruparPropostas(linhas) {
  const agrupadas = {};
  linhas.forEach((linha) => {
    const numero = linha['Número da proposta'];
    if (!numero) return;
    if (!agrupadas[numero]) {
      agrupadas[numero] = {
        id: numero,
        cliente: linha['Nome do contato'] || '',
        vendedor: linha['Vendedor'] || '',
        valor: 0,
        tag_crm: '',
        etapaAtual: '📄 Proposta Criada'
      };
    }
    const valorUnitario = parseValor(linha['Valor unitário']);
    agrupadas[numero].valor += valorUnitario;
  });
  return Object.values(agrupadas);
}

app.post('/upload-planilha', upload.single('file'), (req, res) => {
  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    propostasAgrupadas = agruparPropostas(data);
    res.json({ sucesso: true, propostas: propostasAgrupadas });
  } catch (err) {
    console.error('Erro ao processar planilha:', err);
    res.status(500).json({ sucesso: false, erro: 'Erro ao processar a planilha' });
  }
});

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
    const resultados = propostasAgrupadas.map((proposta) => {
      const pedido = pedidos.find((p) => {
        const obs = p.pedido?.observacoes || '';
        return obs.includes(proposta.tag_crm);
      });
      let novaEtapa = proposta.etapaAtual;
      let status_pedido = 'não encontrado';
      let pedido_id = null;
      if (pedido) {
        status_pedido = pedido.pedido.situacao.toLowerCase();
        pedido_id = pedido.pedido.numero;
        if (status_pedido.includes('cancelado')) {
          novaEtapa = '❌ Cancelados';
        } else if (status_pedido.includes('finalizado')) {
          novaEtapa = '✅ Venda Fechada';
        }
      }
      return {
        ...proposta,
        pedido_id,
        status_pedido,
        novaEtapa
      };
    });
    res.json({ sucesso: true, cruzamento: resultados });
  } catch (err) {
    console.error('Erro na API da Tiny:', err.message);
    res.status(500).json({ sucesso: false, erro: 'Erro na sincronização com a Tiny' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Backend CRM Online');
});

app.listen(port, () => {
  console.log(`🚀 Backend CRM rodando na porta ${port}`);
});
