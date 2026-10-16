const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { handleChatMessage } = require('./routes/chatbot');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/services', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'services.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

app.get('/chatbot', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'chatbot.html'));
});

app.get('/abonnement', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'abonnement.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'faq.html'));
});

app.get('/devis', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'devis.html'));
});


app.get('/newsletter', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'newsletter.html'));
});

app.get('/calculateurs', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'calculateurs.html'));
});

app.get('/rendez-vous', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'rendez-vous.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/applications', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'applications.html'));
});

app.get('/presentation', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'presentation.html'));
});

app.get('/prospectus', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'prospectus.html'));
});

app.get('/applications/erp-gk', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'erp-gk.html'));
});

app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  console.log('Contact form submission:', { name, email, message });
  
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  const contactsFile = path.join(dataDir, 'contacts.json');
  let contacts = [];
  
  if (fs.existsSync(contactsFile)) {
    contacts = JSON.parse(fs.readFileSync(contactsFile, 'utf8'));
  }
  
  contacts.push({
    name,
    email,
    message,
    date: new Date().toISOString()
  });
  
  fs.writeFileSync(contactsFile, JSON.stringify(contacts, null, 2));
  
  res.json({ success: true, message: 'Message reçu avec succès !' });
});

app.post('/api/newsletter', async (req, res) => {
  const { prenom, nom, email, entreprise, secteur } = req.body;
  console.log('Newsletter subscription:', { prenom, nom, email, entreprise, secteur });
  
  try {
    const existing = await pool.query('SELECT id FROM newsletter_subscribers WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.json({ success: false, message: 'Cet email est déjà inscrit à notre newsletter.' });
    }

    await pool.query(
      'INSERT INTO newsletter_subscribers (prenom, nom, email, entreprise, secteur) VALUES ($1, $2, $3, $4, $5)',
      [prenom, nom, email, entreprise, secteur]
    );

    res.json({ success: true, message: 'Merci ! Vous êtes maintenant inscrit à notre newsletter hebdomadaire.' });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.json({ success: false, message: 'Une erreur est survenue. Veuillez réessayer.' });
  }
});

app.post('/api/devis', (req, res) => {
  const devisData = req.body;
  console.log('Devis request:', devisData);
  
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  const devisFile = path.join(dataDir, 'devis.json');
  let devisList = [];
  
  if (fs.existsSync(devisFile)) {
    devisList = JSON.parse(fs.readFileSync(devisFile, 'utf8'));
  }
  
  devisList.push({
    ...devisData,
    date: new Date().toISOString()
  });
  
  fs.writeFileSync(devisFile, JSON.stringify(devisList, null, 2));
  
  res.json({ success: true, message: 'Demande de devis reçue ! Nous vous contacterons sous 24h.' });
});

app.get('/api/newsletters', (req, res) => {
  const indexFile = path.join(__dirname, 'data', 'newsletters', 'index.json');
  if (fs.existsSync(indexFile)) {
    const newsletters = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    res.json({ success: true, newsletters: newsletters.reverse() });
  } else {
    res.json({ success: true, newsletters: [] });
  }
});

app.get('/api/newsletters/:issue', (req, res) => {
  const issue = req.params.issue;
  const filePath = path.join(__dirname, 'data', 'newsletters', `newsletter-${issue}.html`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Newsletter not found' });
  }
});

app.post('/api/newsletters/generate', async (req, res) => {
  try {
    const { generateNewsletter } = require('./scripts/generateNewsletter');
    const result = await generateNewsletter();
    res.json({ success: true, newsletter: result });
  } catch (error) {
    console.error('Error generating newsletter:', error);
    res.json({ success: false, message: 'Erreur lors de la génération de la newsletter.' });
  }
});

app.post('/api/newsletters/send', async (req, res) => {
  try {
    const { runWeeklyNewsletter } = require('./scripts/sendWeeklyNewsletter');
    const result = await runWeeklyNewsletter();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error sending newsletter:', error);
    res.json({ success: false, message: 'Erreur lors de l\'envoi de la newsletter.' });
  }
});

app.get('/api/newsletters/test-email', async (req, res) => {
  try {
    const { testEmailConnection } = require('./lib/emailSender');
    const result = await testEmailConnection();
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/newsletter-subscribers/count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM newsletter_subscribers WHERE active = true');
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error('Count subscribers error:', error);
    res.json({ count: 0 });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  
  if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Mot de passe incorrect' });
  }
});

app.post('/api/rendez-vous', (req, res) => {
  const appointmentData = req.body;
  console.log('Appointment request:', appointmentData);
  
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  const appointmentsFile = path.join(__dirname, 'data', 'appointments.json');
  let appointments = [];
  
  if (fs.existsSync(appointmentsFile)) {
    appointments = JSON.parse(fs.readFileSync(appointmentsFile, 'utf8'));
  }
  
  appointments.push({
    ...appointmentData,
    createdAt: new Date().toISOString()
  });
  
  fs.writeFileSync(appointmentsFile, JSON.stringify(appointments, null, 2));
  
  res.json({ success: true, message: 'Rendez-vous enregistré ! Nous vous confirmerons par email.' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await handleChatMessage(message);
    res.json({ response });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      response: 'Désolé, une erreur est survenue. Veuillez réessayer ou nous contacter directement.'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orionexa website running on http://0.0.0.0:${PORT}`);
});
