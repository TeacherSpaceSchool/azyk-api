const ItemAzyk = require('../models/itemAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');
const {parallelPromise} = require('./parallel');

module.exports.reductionItems = async () => {
    const organizations = await OrganizationAzyk.find().select('_id name cities').lean()
    await parallelPromise(organizations, async (organization) => {
        console.log(`reductionItems ${organization.name}`, await ItemAzyk.updateMany({
            organization: organization._id,
            city: {$ne: organization.cities[0]}
        }, {city: organization.cities[0]}))
    })
}