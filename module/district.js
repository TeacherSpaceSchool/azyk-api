const District = require('../models/districtAzyk');

module.exports.reductionDistrict = async () => {
    console.log('reductionDistrict', (await District.updateMany(
        { ecspeditor: { $ne: null } },
        [
            { $set: { forwarder: '$ecspeditor' } },
            { $unset: 'ecspeditor' }
        ]
    )).modifiedCount)
}