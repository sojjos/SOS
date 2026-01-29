const express = require('express');
const authRoutes = require('./auth');
const companiesRoutes = require('./companies');
const invitationsRoutes = require('./invitations');
const dashboardRoutes = require('./dashboard');
const adminsRoutes = require('./admins');

const router = express.Router();

// Routes d'authentification plateforme
router.use('/auth', authRoutes);

// Routes dashboard plateforme
router.use('/dashboard', dashboardRoutes);

// Routes gestion des entreprises
router.use('/companies', companiesRoutes);

// Routes gestion des codes d'invitation
router.use('/invitations', invitationsRoutes);

// Routes gestion des admins plateforme
router.use('/admins', adminsRoutes);

module.exports = router;
