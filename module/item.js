const ItemAzyk = require('../models/itemAzyk');
const OrganizationAzyk = require('../models/organizationAzyk');

module.exports.reductionItems = async () => {
    const organizations = await OrganizationAzyk.find().select('_id cities').lean()
    for(const organization of organizations) {
        await ItemAzyk.updateMany({organization: organization._id, city: {$ne: organization.cities[0]}}, {city: organization.cities[0]})
    }
}