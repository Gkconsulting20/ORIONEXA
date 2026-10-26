'use strict';

const {
  ensureLeadTable,
  createLead,
  listLeads,
  updateLeadStatus,
  recommendNextAction
} = require('../sales_agent/lead_engine');

function registerSalesRoutes(app, pool, requireAdmin) {
  let tableReady;
  const ready = () => {
    if (!tableReady) tableReady = ensureLeadTable(pool).catch(error => {
      tableReady = null;
      throw error;
    });
    return tableReady;
  };

  app.get('/api/sales/leads', requireAdmin, async (req, res) => {
    try {
      await ready();
      const limit = Number.parseInt(req.query.limit || '50', 10);
      const offset = Number.parseInt(req.query.offset || '0', 10);
      const leads = await listLeads(pool, {
        status: req.query.status || undefined,
        limit: Number.isFinite(limit) ? limit : 50,
        offset: Number.isFinite(offset) ? offset : 0
      });
      res.json({ success: true, leads });
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ success: false, message: error.message });
      console.error('ORIONEXA-SALES list error:', error);
      res.status(500).json({ success: false, message: 'Impossible de charger les prospects.' });
    }
  });

  app.post('/api/sales/leads', requireAdmin, async (req, res) => {
    try {
      await ready();
      const lead = await createLead(pool, req.body || {});
      res.status(201).json({
        success: true,
        lead,
        nextAction: recommendNextAction(lead)
      });
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ success: false, message: error.message });
      console.error('ORIONEXA-SALES create error:', error);
      res.status(500).json({ success: false, message: 'Impossible d’enregistrer ce prospect.' });
    }
  });

  app.patch('/api/sales/leads/:id/status', requireAdmin, async (req, res) => {
    try {
      await ready();
      const lead = await updateLeadStatus(pool, req.params.id, req.body && req.body.status);
      if (!lead) return res.status(404).json({ success: false, message: 'Prospect introuvable.' });
      res.json({ success: true, lead });
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ success: false, message: error.message });
      console.error('ORIONEXA-SALES status update error:', error);
      res.status(500).json({ success: false, message: 'Impossible de modifier le statut.' });
    }
  });
}

module.exports = { registerSalesRoutes };
