/**
 * Local Development Server for WebWynk CRM.
 * Imports the unified Express application from api/index.js
 * and runs it locally on the specified port.
 */

const express = require('express');
const app = require('./api/index');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 WebWynk CRM running locally at http://localhost:${PORT}`);
  console.log(`   Admin Login: http://localhost:${PORT}/index.html`);
});
