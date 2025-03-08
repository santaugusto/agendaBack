const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
const port = 3000;
const cors = require('cors');
app.use(cors());

require('dotenv').config();

// Permite a leitura de JSON no corpo das requisições
app.use(express.json());

// Cria um pool de conexões com o MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,      
  user: process.env.DB_USER,      
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

/**
 * Endpoint para adicionar uma nova tarefa.
 * Recebe no corpo da requisição os campos: text, date e priority.
 */
app.post('/tasks', async (req, res) => {
  const { text, date, priority } = req.body;
  if (!text || !date || !priority) {
    return res.status(400).json({ error: 'Faltam campos obrigatórios (text, date, priority).' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO tasks (text, date, priority) VALUES (?, ?, ?)',
      [text, date, priority]
    );
    res.status(201).json({ id: result.insertId, text, date, priority });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao inserir a tarefa.' });
  }
});

/**
 * Endpoint para listar todas as tarefas.
 */
app.get('/tasks', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM tasks');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar as tarefas.' });
  }
});

/**
 * Endpoint para deletar uma tarefa pelo ID.
 */
app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada.' });
    }
    res.json({ message: 'Tarefa deletada com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao deletar a tarefa.' });
  }
});

/**
 * Endpoint para buscar as tarefas de uma semana específica.
 * Opcionalmente, recebe uma data de início da semana via query string (formato YYYY-MM-DD).
 * Se não for informada, utiliza a semana atual (a partir do domingo).
 */
app.get('/tasks/week', async (req, res) => {
  let { start } = req.query;
  let startDate;
  if (start) {
    startDate = new Date(start);
  } else {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - startDate.getDay());
  }
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  // Função para formatar data como YYYY-MM-DD
  const formatDate = d => d.toISOString().split('T')[0];

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM tasks WHERE date BETWEEN ? AND ?',
      [formatDate(startDate), formatDate(endDate)]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar as tarefas da semana.' });
  }
});

// Inicializa o servidor
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
