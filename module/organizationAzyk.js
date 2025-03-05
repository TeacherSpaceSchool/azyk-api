const OrganizationAzyk = require('../models/organizationAzyk');

module.exports.reductionToOrganization= async()=>{
    let organizations = await OrganizationAzyk.updateMany({agentHistory: null}, {agentHistory: 100})
    console.log(`reductionToOrganization: ${organizations.nModified}`)
}