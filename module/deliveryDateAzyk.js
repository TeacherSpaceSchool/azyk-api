const DeliveryDateAzyk = require('../models/deliveryDateAzyk');

module.exports.reductionDeliveryDateAzyk = async () => {
    console.log('reductionDeliveryDateAzyk', (await DeliveryDateAzyk.deleteMany({client: {$ne: null}})).deletedCount)
}