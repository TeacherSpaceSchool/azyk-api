const AdsAzyk = require('../models/adsAzyk');

module.exports.reductionAdsAzyk = async () => {
    console.log('reductionAdsAzyk', (await AdsAzyk.updateMany({$or: [{paymentMethods: null}, {paymentMethods: {$size: 0}}]}, {paymentMethods: ['Наличные', 'Перечисление', 'Консигнация']})).nModified)
}