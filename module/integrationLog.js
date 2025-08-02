const IntegrationLogAzyk = require('../models/integrationLogAzyk');

module.exports.addIntegrationLog = async ({organization, path, xml}) => {
    await IntegrationLogAzyk.create({organization, path, xml: JSON.stringify(xml, null, 2)})
}