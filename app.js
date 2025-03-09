require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');



const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Cria um pool de conexões com o MySQL utilizando variáveis de ambiente
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});


// Endpoint para cadastro de usuário
app.post('/cadastro', async (req, res) => {
  const { nome, email, senha, confirmar_senha } = req.body;

  // Validação básica
  if (!nome || !email || !senha || !confirmar_senha) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (senha !== confirmar_senha) {
    return res.status(400).json({ message: 'As senhas não coincidem.' });
  }

  try {
    // Verificando se o e-mail já existe no banco de dados
    const [rows] = await pool.query('SELECT * FROM usuario WHERE email = ?', [email]);

    if (rows.length > 0) {
      return res.status(400).json({ message: 'E-mail já cadastrado.' });
    }

    // Criptografando a senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Inserindo o usuário no banco de dados
    const query = 'INSERT INTO usuario (nome, email, senha) VALUES (?, ?, ?)';
    const [result] = await pool.query(query, [nome, email, hashedPassword]);

    // Retornando resposta com sucesso
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao processar o cadastro:', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// Rota de Login
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  // Validação básica
  if (!email || !senha) {
    return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
  }

  try {
    // Verificar se o e-mail existe no banco de dados
    const [rows] = await pool.query('SELECT * FROM usuario WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'E-mail não encontrado.' });
    }

    // Verificar se a senha fornecida corresponde à senha do banco de dados
    const usuario = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

    if (!senhaCorreta) {
      return res.status(401).json({ message: 'Senha incorreta.' });
    }

    // Gerar o token JWT
    const token = jwt.sign({ id: usuario.id, nome: usuario.nome, email: usuario.email }, 'seu_segredo', { expiresIn: '1h' });

    // Retornar a resposta com o token
    return res.status(200).json({ message: 'Login bem-sucedido!', token });

  } catch (error) {
    console.error('Erro ao realizar o login:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});



app.get('/usuario/:id/tasks', async (req, res) => {
  const { id } = req.params;

  try {
    // Consulta para buscar todas as tasks relacionadas a um usuário
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE usuario_id = ?', [id]);

    if (tasks.length === 0) {
      return res.status(404).json({ message: 'Nenhuma tarefa encontrada para este usuário.' });
    }

    return res.status(200).json({ tasks });

  } catch (error) {
    console.error('Erro ao buscar as tarefas do usuário:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.post('/usuario/:id/task', async (req, res) => {
  const { id } = req.params;
  const { text, date, priority, folder } = req.body;
  // Verificar se os campos obrigatórios foram preenchidos
  if (!text || !date || !priority || !folder) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }
  const concluded = false
  try {
    // Inserir nova tarefa associada ao usuário
    const [result] = await pool.query(
      'INSERT INTO tasks (text, date, priority, folder,concluded, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
      [text, date, priority, folder,concluded,id]
    );

    return res.status(201).json({ message: 'Tarefa criada com sucesso!', taskId: result.insertId });

  } catch (error) {
    console.error('Erro ao criar a tarefa:', error);
    return res.status(500).json({ message: 'Erro interno ao criar a tarefa.' });
  }
});


app.put('/usuario/:usuarioId/task/:taskId', async (req, res) => {
  const { usuarioId, taskId } = req.params;
  const { text, date, priority, folder, concluded } = req.body;

  // Verificar se todos os campos obrigatórios estão presentes
  if (!text || !date || !priority || !folder || concluded === undefined) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    // Verificar se a tarefa existe e pertence ao usuário
    const [task] = await pool.query('SELECT * FROM tasks WHERE id = ? AND usuario_id = ?', [taskId, usuarioId]);

    if (task.length === 0) {
      return res.status(404).json({ message: 'Tarefa não encontrada para este usuário.' });
    }

    // Atualizando a tarefa
    const [result] = await pool.query(
      'UPDATE tasks SET text = ?, date = ?, priority = ?, folder = ?, concluded = ? WHERE id = ?',
      [text, date, priority, folder, concluded, taskId]
    );

    return res.status(200).json({ message: 'Tarefa atualizada com sucesso!' });

  } catch (error) {
    console.error('Erro ao atualizar a tarefa:', error);
    return res.status(500).json({ message: 'Erro interno ao atualizar a tarefa.' });
  }
});


app.delete('/usuario/:usuarioId/task/:taskId', async (req, res) => {
  const { usuarioId, taskId } = req.params;

  try {
    // Verificar se a tarefa existe e pertence ao usuário
    const [task] = await pool.query('SELECT * FROM tasks WHERE id = ? AND usuario_id = ?', [taskId, usuarioId]);

    if (task.length === 0) {
      return res.status(404).json({ message: 'Tarefa não encontrada para este usuário.' });
    }

    // Deletando a tarefa
    await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);

    return res.status(200).json({ message: 'Tarefa deletada com sucesso!' });

  } catch (error) {
    console.error('Erro ao deletar a tarefa:', error);
    return res.status(500).json({ message: 'Erro interno ao deletar a tarefa.' });
  }
});



/**
 * Endpoint para adicionar uma nova tarefa.
 * Recebe no corpo da requisição os campos: text, date, priority e folder.
 * O campo concluded é definido como false por padrão.
 */
app.post('/tasks', async (req, res) => {
  const { text, date, priority, folder } = req.body;
  if (!text || !date || !priority) {
    return res.status(400).json({ error: 'Faltam campos obrigatórios (text, date, priority).' });
  }
  try {
    // Se folder não for informado, define uma pasta padrão
    const folderValue = folder || 'default';
    const concluded = false; // Por padrão, a tarefa não está concluída
    const [result] = await pool.execute(
      'INSERT INTO tasks (text, date, priority, folder, concluded) VALUES (?, ?, ?, ?, ?)',
      [text, date, priority, folderValue, concluded]
    );
    res.status(201).json({ id: result.insertId, text, date, priority, folder: folderValue, concluded });
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
 * Endpoint para atualizar o status de conclusão de uma tarefa.
 * Recebe no corpo da requisição o campo 'concluded' (true ou false).
 */
app.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { concluded } = req.body;
  if (typeof concluded === 'undefined') {
    return res.status(400).json({ error: 'Campo concluded é obrigatório para atualização.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE tasks SET concluded = ? WHERE id = ?',
      [concluded, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Tarefa não encontrada.' });
    }
    res.json({ message: 'Tarefa atualizada com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar a tarefa.' });
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
