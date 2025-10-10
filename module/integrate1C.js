const Integrate1C = require('../models/integrate1CAzyk');

module.exports.reductionIntegrate1C = async () => {
    console.log('reductionIntegrate1C', (await Integrate1C.updateMany(
        { ecspeditor: { $ne: null } },
        [
            { $set: { forwarder: '$ecspeditor' } },
            { $unset: 'ecspeditor' }
        ]
    )).modifiedCount)
}